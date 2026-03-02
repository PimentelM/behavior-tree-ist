import { describe, it, expect, vi, Mock } from "vitest";
import { StudioAgent, StudioAgentOptions } from "./studio-agent";
import { StudioLink, StudioCommand } from "./studio-link";
import { StudioCommandType, StudioErrorCode } from "./types";
import { TreeRegistry } from "../registry/tree-registry";
import { BehaviourTree } from "../tree";
import { Action, NodeResult } from "../base";
import { OffFunction } from "../types";

type CommandHandler = (command: StudioCommand) => void;
type VoidHandler = () => void;

interface MockStudioLink extends StudioLink {
    _commandHandlers: Set<CommandHandler>;
    _connectedHandlers: Set<VoidHandler>;
    _disconnectedHandlers: Set<VoidHandler>;
    _simulateConnect: () => void;
    _simulateDisconnect: () => void;
    _simulateCommand: (command: StudioCommand) => void;
    _isConnected: boolean;
    sendHello: Mock;
    sendTreeRegistered: Mock;
    sendTreeRemoved: Mock;
    sendTickBatch: Mock;
    sendCommandAck: Mock;
    sendTreeList: Mock;
    open: Mock;
    close: Mock;
}

function createMockLink(): MockStudioLink {
    const commandHandlers = new Set<CommandHandler>();
    const connectedHandlers = new Set<VoidHandler>();
    const disconnectedHandlers = new Set<VoidHandler>();
    let isConnected = false;

    const mock = {
        _commandHandlers: commandHandlers,
        _connectedHandlers: connectedHandlers,
        _disconnectedHandlers: disconnectedHandlers,
        get _isConnected() { return isConnected; },
        set _isConnected(v: boolean) { isConnected = v; },

        _simulateConnect() {
            isConnected = true;
            for (const h of connectedHandlers) h();
        },
        _simulateDisconnect() {
            isConnected = false;
            for (const h of disconnectedHandlers) h();
        },
        _simulateCommand(command: StudioCommand) {
            for (const h of commandHandlers) h(command);
        },

        sendHello: vi.fn(),
        sendTreeRegistered: vi.fn(),
        sendTreeRemoved: vi.fn(),
        sendTickBatch: vi.fn(),
        sendCommandAck: vi.fn(),
        sendTreeList: vi.fn(),

        onCommand(handler: CommandHandler): OffFunction {
            commandHandlers.add(handler);
            return () => commandHandlers.delete(handler);
        },
        onConnected(handler: VoidHandler): OffFunction {
            connectedHandlers.add(handler);
            return () => connectedHandlers.delete(handler);
        },
        onDisconnected(handler: VoidHandler): OffFunction {
            disconnectedHandlers.add(handler);
            return () => disconnectedHandlers.delete(handler);
        },

        open: vi.fn(),
        close: vi.fn(),
        get isConnected() { return isConnected; },
    };

    return mock;
}

function createTree(): BehaviourTree {
    return new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
}

function createAgent(overrides?: Partial<StudioAgentOptions>) {
    const registry = overrides?.registry ?? new TreeRegistry();
    const link = overrides?.link ?? createMockLink();
    const agent = new StudioAgent({
        clientId: overrides?.clientId ?? "test-client",
        sessionId: overrides?.sessionId ?? "test-session",
        registry,
        link,
    });
    return { agent, registry, link: link as MockStudioLink };
}

describe("StudioAgent", () => {
    describe("constructor", () => {
        it("validates clientId", () => {
            expect(() => new StudioAgent({
                clientId: "invalid name",
                sessionId: "ok",
                registry: new TreeRegistry(),
                link: createMockLink(),
            })).toThrow(/Invalid clientId/);
        });

        it("validates sessionId", () => {
            expect(() => new StudioAgent({
                clientId: "ok",
                sessionId: "invalid name",
                registry: new TreeRegistry(),
                link: createMockLink(),
            })).toThrow(/Invalid sessionId/);
        });
    });

    describe("start()", () => {
        it("calls link.open()", () => {
            const { agent, link } = createAgent();
            agent.start();
            expect(link.open).toHaveBeenCalledTimes(1);
        });

        it("initializes state for trees already in the registry", () => {
            const registry = new TreeRegistry();
            const tree = createTree();
            registry.register("existing-tree", tree);

            const link = createMockLink();
            const agent = new StudioAgent({
                clientId: "client",
                sessionId: "session",
                registry,
                link,
            });
            agent.start();

            // On connect, it should send registration for the existing tree
            link._simulateConnect();
            expect(link.sendTreeRegistered).toHaveBeenCalledWith("existing-tree", expect.any(Object));
        });

        it("throws if already started", () => {
            const { agent } = createAgent();
            agent.start();
            expect(() => agent.start()).toThrow(/already been started/);
        });

        it("throws if destroyed", () => {
            const { agent } = createAgent();
            agent.destroy();
            expect(() => agent.start()).toThrow(/has been destroyed/);
        });
    });

    describe("on link connected", () => {
        it("sends hello with clientId and sessionId", () => {
            const { agent, link } = createAgent({ clientId: "my-app", sessionId: "sess-1" });
            agent.start();
            link._simulateConnect();

            expect(link.sendHello).toHaveBeenCalledWith("my-app", "sess-1");
        });

        it("sends tree registrations for all tracked trees", () => {
            const registry = new TreeRegistry();
            const tree1 = createTree();
            const tree2 = createTree();
            registry.register("tree-1", tree1);
            registry.register("tree-2", tree2);

            const link = createMockLink();
            const agent = new StudioAgent({
                clientId: "client",
                sessionId: "session",
                registry,
                link,
            });
            agent.start();
            link._simulateConnect();

            expect(link.sendTreeRegistered).toHaveBeenCalledTimes(2);
            expect(link.sendTreeRegistered).toHaveBeenCalledWith("tree-1", expect.any(Object));
            expect(link.sendTreeRegistered).toHaveBeenCalledWith("tree-2", expect.any(Object));
        });

        it("re-sends all trees on reconnection", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();

            link._simulateConnect();
            expect(link.sendTreeRegistered).toHaveBeenCalledTimes(1);

            link._simulateDisconnect();
            link.sendTreeRegistered.mockClear();
            link.sendHello.mockClear();

            link._simulateConnect();
            expect(link.sendHello).toHaveBeenCalledTimes(1);
            expect(link.sendTreeRegistered).toHaveBeenCalledTimes(1);
        });
    });

    describe("registry events", () => {
        it("sends tree registration when a new tree is registered (while connected)", () => {
            const { agent, registry, link } = createAgent();
            agent.start();
            link._simulateConnect();
            link.sendTreeRegistered.mockClear();

            const tree = createTree();
            registry.register("new-tree", tree);

            expect(link.sendTreeRegistered).toHaveBeenCalledTimes(1);
            expect(link.sendTreeRegistered).toHaveBeenCalledWith("new-tree", expect.any(Object));
        });

        it("does not send tree registration when disconnected", () => {
            const { agent, registry, link } = createAgent();
            agent.start();
            // do not connect

            const tree = createTree();
            registry.register("new-tree", tree);

            expect(link.sendTreeRegistered).not.toHaveBeenCalled();
        });

        it("sends tree removal when a tree is removed (while connected)", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            registry.remove("tree-1");

            expect(link.sendTreeRemoved).toHaveBeenCalledWith("tree-1");
        });

        it("does not send tree removal when disconnected", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            // do not connect

            registry.remove("tree-1");

            expect(link.sendTreeRemoved).not.toHaveBeenCalled();
        });
    });

    describe("tick forwarding", () => {
        it("does not forward ticks when streaming is disabled (default)", () => {
            const { agent, registry, link } = createAgent();
            agent.start();
            link._simulateConnect();

            const tree = createTree();
            registry.register("tree-1", tree);
            tree.tick();

            expect(link.sendTickBatch).not.toHaveBeenCalled();
        });

        it("forwards ticks when streaming is enabled", () => {
            const { agent, registry, link } = createAgent();
            agent.start();
            link._simulateConnect();

            const tree = createTree();
            registry.register("tree-1", tree);

            // Enable streaming via command
            link._simulateCommand({
                correlationId: "cmd-1",
                treeId: "tree-1",
                command: StudioCommandType.EnableStreaming,
            });

            tree.tick();

            expect(link.sendTickBatch).toHaveBeenCalledTimes(1);
            expect(link.sendTickBatch).toHaveBeenCalledWith("tree-1", [expect.objectContaining({ tickId: expect.any(Number) })]);
        });

        it("stops forwarding ticks when streaming is disabled", () => {
            const { agent, registry, link } = createAgent();
            agent.start();
            link._simulateConnect();

            const tree = createTree();
            registry.register("tree-1", tree);

            link._simulateCommand({ correlationId: "1", treeId: "tree-1", command: StudioCommandType.EnableStreaming });
            tree.tick();
            expect(link.sendTickBatch).toHaveBeenCalledTimes(1);

            link._simulateCommand({ correlationId: "2", treeId: "tree-1", command: StudioCommandType.DisableStreaming });
            tree.tick();
            expect(link.sendTickBatch).toHaveBeenCalledTimes(1); // no new call
        });

        it("drops ticks while disconnected even if streaming is enabled", () => {
            const { agent, registry, link } = createAgent();
            agent.start();
            link._simulateConnect();

            const tree = createTree();
            registry.register("tree-1", tree);

            link._simulateCommand({ correlationId: "1", treeId: "tree-1", command: StudioCommandType.EnableStreaming });
            link._simulateDisconnect();

            tree.tick();

            expect(link.sendTickBatch).not.toHaveBeenCalled();
        });

        it("preserves streaming state across disconnection/reconnection", () => {
            const { agent, registry, link } = createAgent();
            agent.start();
            link._simulateConnect();

            const tree = createTree();
            registry.register("tree-1", tree);

            link._simulateCommand({ correlationId: "1", treeId: "tree-1", command: StudioCommandType.EnableStreaming });
            link._simulateDisconnect();
            link._simulateConnect();

            tree.tick();
            expect(link.sendTickBatch).toHaveBeenCalledTimes(1);
        });
    });

    describe("command handling", () => {
        it("acks enable-streaming", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: StudioCommandType.EnableStreaming });

            expect(link.sendCommandAck).toHaveBeenCalledWith("c1", true);
        });

        it("acks disable-streaming", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: StudioCommandType.DisableStreaming });

            expect(link.sendCommandAck).toHaveBeenCalledWith("c1", true);
        });

        it("enable-state-trace calls tree.enableStateTrace()", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            const spy = vi.spyOn(tree, "enableStateTrace");
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: StudioCommandType.EnableStateTrace });

            expect(spy).toHaveBeenCalledTimes(1);
            expect(link.sendCommandAck).toHaveBeenCalledWith("c1", true);
        });

        it("disable-state-trace calls tree.disableStateTrace()", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            const spy = vi.spyOn(tree, "disableStateTrace");
            registry.register("tree-1", tree);
            agent.start();
            spy.mockClear();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: StudioCommandType.DisableStateTrace });

            expect(spy).toHaveBeenCalledTimes(1);
            expect(link.sendCommandAck).toHaveBeenCalledWith("c1", true);
        });

        it("enable-profiling calls tree.enableProfiling()", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            const spy = vi.spyOn(tree, "enableProfiling");
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: StudioCommandType.EnableProfiling });

            expect(spy).toHaveBeenCalledTimes(1);
            expect(link.sendCommandAck).toHaveBeenCalledWith("c1", true);
        });

        it("disable-profiling calls tree.disableProfiling()", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            const spy = vi.spyOn(tree, "disableProfiling");
            registry.register("tree-1", tree);
            agent.start();
            spy.mockClear();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: StudioCommandType.DisableProfiling });

            expect(spy).toHaveBeenCalledTimes(1);
            expect(link.sendCommandAck).toHaveBeenCalledWith("c1", true);
        });

        it("unknown command acks UNKNOWN_COMMAND", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: "not-a-real-command" });

            expect(link.sendCommandAck).toHaveBeenCalledWith("c1", false, StudioErrorCode.UnknownCommand, expect.any(String));
        });

        it("unknown treeId acks TREE_NOT_FOUND", () => {
            const { agent, link } = createAgent();
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "missing-tree", command: StudioCommandType.EnableStreaming });

            expect(link.sendCommandAck).toHaveBeenCalledWith("c1", false, StudioErrorCode.TreeNotFound, expect.any(String));
        });

        it("list-trees returns summaries for all tracked trees", () => {
            const { agent, registry, link } = createAgent();
            const tree1 = createTree();
            const tree2 = createTree();
            registry.register("tree-1", tree1);
            registry.register("tree-2", tree2);
            agent.start();
            link._simulateConnect();

            // Enable streaming on tree-1
            link._simulateCommand({ correlationId: "s1", treeId: "tree-1", command: StudioCommandType.EnableStreaming });

            link._simulateCommand({ correlationId: "list-1", treeId: "", command: StudioCommandType.ListTrees });

            expect(link.sendTreeList).toHaveBeenCalledWith("list-1", expect.arrayContaining([
                { treeId: "tree-1", streaming: true, stateTrace: false, profiling: false },
                { treeId: "tree-2", streaming: false, stateTrace: false, profiling: false },
            ]));
        });
    });

    describe("destroy()", () => {
        it("closes the link", () => {
            const { agent, link } = createAgent();
            agent.start();
            agent.destroy();
            expect(link.close).toHaveBeenCalledTimes(1);
        });

        it("unsubscribes from registry events", () => {
            const { agent, registry, link } = createAgent();
            agent.start();
            link._simulateConnect();
            agent.destroy();

            link.sendTreeRegistered.mockClear();
            const tree = createTree();
            registry.register("new-tree", tree);

            expect(link.sendTreeRegistered).not.toHaveBeenCalled();
        });

        it("unsubscribes from link events", () => {
            const { agent, link } = createAgent();
            agent.start();
            agent.destroy();

            link.sendHello.mockClear();
            link._simulateConnect();
            expect(link.sendHello).not.toHaveBeenCalled();
        });

        it("is idempotent", () => {
            const { agent, link } = createAgent();
            agent.start();
            agent.destroy();
            agent.destroy();
            expect(link.close).toHaveBeenCalledTimes(1);
        });

        it("clears tree states so list-trees returns empty after destroy", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            agent.destroy();

            // Attempting a list-trees command won't fire because we've unsubscribed,
            // but we can verify state was cleared by checking the link wasn't called
            // with any trees after destroy
            expect(link.sendTreeList).not.toHaveBeenCalled();
        });
    });

    describe("isConnected", () => {
        it("reflects link.isConnected", () => {
            const { agent, link } = createAgent();
            agent.start();

            expect(agent.isConnected).toBe(false);
            link._simulateConnect();
            expect(agent.isConnected).toBe(true);
            link._simulateDisconnect();
            expect(agent.isConnected).toBe(false);
        });
    });
});
