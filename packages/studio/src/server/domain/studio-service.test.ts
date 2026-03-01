import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { StudioService } from "./studio-service";
import { ClientRepository, TreeRepository, TickRepository, AgentGateway } from "./interfaces";
import { ClientNotFoundError, TreeNotFoundError } from "./errors";
import { computeTreeHash } from "./hash";

describe("StudioService", () => {
    let clientRepo: Mocked<ClientRepository>;
    let treeRepo: Mocked<TreeRepository>;
    let tickRepo: Mocked<TickRepository>;
    let agentGateway: Mocked<AgentGateway>;
    let service: StudioService;

    const mockNode = { id: 1, type: "action" as const, name: "NodeA", nodeFlags: 0, defaultName: "NodeA" };
    const mockHash = computeTreeHash(mockNode);

    beforeEach(() => {
        clientRepo = {
            upsert: vi.fn(),
            findById: vi.fn(),
            findAll: vi.fn(),
            delete: vi.fn(),
            setOnline: vi.fn(),
        } as any;

        treeRepo = {
            upsert: vi.fn(),
            find: vi.fn(),
            findByClient: vi.fn(),
            delete: vi.fn(),
            deleteByClient: vi.fn(),
        } as any;

        tickRepo = {
            push: vi.fn(),
            query: vi.fn(),
            clearByTree: vi.fn(),
            clearByClient: vi.fn(),
        } as any;

        agentGateway = {
            sendCommand: vi.fn().mockResolvedValue(undefined),
            onCommandAck: vi.fn().mockReturnValue(() => { }),
        } as any;

        service = new StudioService(clientRepo, treeRepo, tickRepo, agentGateway);
    });

    it("registerClient upserts client with online state", () => {
        service.registerClient("client-1");
        expect(clientRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
            clientId: "client-1",
            isOnline: true
        }));
    });

    it("unregisterClient marks offline and clears associated resources", () => {
        clientRepo.findById.mockReturnValue({ clientId: "client-1", isOnline: true } as any);

        service.unregisterClient("client-1");

        expect(clientRepo.setOnline).toHaveBeenCalledWith("client-1", false, expect.any(Number));
        expect(treeRepo.deleteByClient).toHaveBeenCalledWith("client-1");
        expect(tickRepo.clearByClient).toHaveBeenCalledWith("client-1");
    });

    it("registerTree upserts tree and clears previous ticks", () => {
        clientRepo.findById.mockReturnValue({ clientId: "client-1", isOnline: true } as any);

        service.registerTree("client-1", "tree-1", mockNode);

        expect(treeRepo.upsert).toHaveBeenCalledWith("client-1", "tree-1", mockNode, mockHash);
        expect(tickRepo.clearByTree).toHaveBeenCalledWith("client-1", "tree-1");
    });

    it("registerTree throws if client not found", () => {
        clientRepo.findById.mockReturnValue(undefined);
        expect(() => service.registerTree("client-1", "tree-1", mockNode)).toThrow(ClientNotFoundError);
    });

    it("unregisterTree deletes tree and clears ticks", () => {
        service.unregisterTree("client-1", "tree-1");
        expect(treeRepo.delete).toHaveBeenCalledWith("client-1", "tree-1");
        expect(tickRepo.clearByTree).toHaveBeenCalledWith("client-1", "tree-1");
    });

    it("updateTree upserts only if hash is different", () => {
        treeRepo.find.mockReturnValue({ hash: "different-hash" } as any);
        service.updateTree("client-1", "tree-1", mockNode);
        expect(treeRepo.upsert).toHaveBeenCalledWith("client-1", "tree-1", mockNode, mockHash);
    });

    it("updateTree does not upsert if hash matches", () => {
        treeRepo.find.mockReturnValue({ hash: mockHash } as any);
        service.updateTree("client-1", "tree-1", mockNode);
        expect(treeRepo.upsert).not.toHaveBeenCalled();
    });

    it("processTicks throws if tree not found", () => {
        treeRepo.find.mockReturnValue(undefined);
        expect(() => service.processTicks("client-1", "tree-1", [])).toThrow(TreeNotFoundError);
    });

    it("processTicks pushes ticks to repo", () => {
        treeRepo.find.mockReturnValue({} as any);
        service.processTicks("client-1", "tree-1", [{ tickId: 1 } as any]);
        expect(tickRepo.push).toHaveBeenCalledWith("client-1", "tree-1", [{ tickId: 1 }]);
    });

    it("enableStreaming validates client and tree exist and sends command", async () => {
        clientRepo.findById.mockReturnValue({ isOnline: true } as any);
        treeRepo.find.mockReturnValue({} as any);

        let ackHandler: any;
        agentGateway.onCommandAck.mockImplementation((handler: any) => {
            ackHandler = handler;
            return () => { };
        });

        agentGateway.sendCommand.mockImplementation(async (clientId, correlationId, command, treeId) => {
            if (ackHandler) {
                setTimeout(() => ackHandler({ correlationId, success: true }));
            }
        });

        const promise = service.enableStreaming("client-1", "tree-1");

        // Wait for the promise to resolve (the ack should trigger it)
        await promise;

        expect(agentGateway.sendCommand).toHaveBeenCalledWith(
            "client-1",
            expect.any(String),
            "enable-streaming",
            "tree-1"
        );
    });
});
