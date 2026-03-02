import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { StudioService } from "./studio-service";
import { ClientRepository, TreeRepository, TickRepository, AgentGateway } from "./interfaces";
import { TreeNotFoundError } from "./errors";
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
        } as unknown as Mocked<ClientRepository>;

        treeRepo = {
            upsert: vi.fn(),
            find: vi.fn(),
            findByClient: vi.fn(),
            delete: vi.fn(),
            deleteByClient: vi.fn(),
        } as unknown as Mocked<TreeRepository>;

        tickRepo = {
            push: vi.fn(),
            query: vi.fn(),
            clearByTree: vi.fn(),
            clearByClient: vi.fn(),
        } as unknown as Mocked<TickRepository>;

        agentGateway = {
            sendCommand: vi.fn().mockResolvedValue(undefined),
            onCommandAck: vi.fn().mockReturnValue(() => { }),
        } as unknown as Mocked<AgentGateway>;

        service = new StudioService(clientRepo, treeRepo, tickRepo, agentGateway);
    });

    it("registerClient upserts client with online state", () => {
        service.registerClient("client-1");
        expect(clientRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
            clientId: "client-1",
            isOnline: true
        }));
    });

    it("unregisterClient marks offline but retains data (offline retention)", () => {
        clientRepo.findById.mockReturnValue({ clientId: "client-1", isOnline: true } as any);

        service.unregisterClient("client-1");

        expect(clientRepo.setOnline).toHaveBeenCalledWith("client-1", false, expect.any(Number));
        // Data should NOT be deleted on disconnect (offline retention criteria)
        expect(treeRepo.deleteByClient).not.toHaveBeenCalled();
        expect(tickRepo.clearByClient).not.toHaveBeenCalled();
    });

    it("deleteClient hard-deletes client-scoped data", () => {
        service.deleteClient("client-1");

        expect(clientRepo.delete).toHaveBeenCalledWith("client-1");
        expect(treeRepo.deleteByClient).toHaveBeenCalledWith("client-1");
        expect(tickRepo.clearByClient).toHaveBeenCalledWith("client-1");
    });

    it("registerTree upserts tree and clears previous ticks", () => {
        clientRepo.findById.mockReturnValue({ clientId: "client-1", isOnline: true } as any);

        service.registerTree("client-1", "tree-1", mockNode);

        expect(treeRepo.upsert).toHaveBeenCalledWith("client-1", "tree-1", mockNode, mockHash);
        expect(tickRepo.clearByTree).toHaveBeenCalledWith("client-1", "tree-1");
    });

    it("registerTree upserts even when no prior tree exists (first registration clears ticks)", () => {
        treeRepo.find.mockReturnValue(undefined);

        service.registerTree("client-1", "tree-1", mockNode);

        expect(treeRepo.upsert).toHaveBeenCalledWith("client-1", "tree-1", mockNode, mockHash);
        expect(tickRepo.clearByTree).toHaveBeenCalledWith("client-1", "tree-1");
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

        agentGateway.sendCommand.mockImplementation(async (_clientId, correlationId, _command, _treeId) => {
            if (ackHandler) {
                setTimeout(() => ackHandler({ correlationId, success: true }));
            }
        });

        const result = await service.enableStreaming("client-1", "tree-1");

        expect(result).toEqual({ success: true });

        expect(agentGateway.sendCommand).toHaveBeenCalledWith(
            "client-1",
            expect.any(String),
            "enable-streaming",
            "tree-1"
        );
    });

    it("enableStreaming returns structured command rejection when ack fails", async () => {
        clientRepo.findById.mockReturnValue({ isOnline: true } as any);
        treeRepo.find.mockReturnValue({} as any);

        let ackHandler: any;
        agentGateway.onCommandAck.mockImplementation((handler: any) => {
            ackHandler = handler;
            return () => { };
        });

        agentGateway.sendCommand.mockImplementation(async (_clientId, correlationId, _command, _treeId) => {
            if (ackHandler) {
                setTimeout(() =>
                    ackHandler({
                        correlationId,
                        success: false,
                        errorCode: "COMMAND_EXECUTION_ERROR",
                        errorMessage: "Cannot enable profiling without a cached time provider",
                    })
                );
            }
        });

        const result = await service.enableStreaming("client-1", "tree-1");
        expect(result).toEqual({
            success: false,
            errorCode: "COMMAND_EXECUTION_ERROR",
            errorMessage: "Cannot enable profiling without a cached time provider",
        });
    });
});
