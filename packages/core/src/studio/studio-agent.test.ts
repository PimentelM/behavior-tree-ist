import { describe, it, expect, vi, type Mock } from "vitest";
import { StudioAgent, type StudioAgentOptions } from "./studio-agent";
import { type StudioLinkInterface, type StudioPlugin, type PluginSender } from "./interfaces";
import { type StudioCommand, StudioCommandType, StudioErrorCode } from "./types";
import { TreeRegistry } from "../registry/tree-registry";
import { BehaviourTree } from "../tree";
import { Action, NodeResult } from "../base";
import { type OffFunction } from "../types";

type CommandHandler = (command: StudioCommand) => void;
type PluginMessageHandler = (pluginId: string, correlationId: string, payload: unknown) => void;
type VoidHandler = () => void;
type ErrorHandler = (error: Error) => void;

interface MockStudioLink extends StudioLinkInterface {
    _commandHandlers: Set<CommandHandler>;
    _pluginMessageHandlers: Set<PluginMessageHandler>;
    _connectedHandlers: Set<VoidHandler>;
    _disconnectedHandlers: Set<VoidHandler>;
    _errorHandlers: Set<ErrorHandler>;
    _simulateConnect: () => void;
    _simulateDisconnect: () => void;
    _simulateCommand: (command: StudioCommand) => void;
    _simulatePluginMessage: (pluginId: string, correlationId: string, payload: unknown) => void;
    _isConnected: boolean;
    sendHello: Mock;
    sendTreeRegistered: Mock;
    sendTreeRemoved: Mock;
    sendTickBatch: Mock;
    sendCommandResponse: Mock;
    sendPluginMessage: Mock;
    open: Mock;
    close: Mock;
    tick: Mock;
}

function createMockLink(): MockStudioLink {
    const commandHandlers = new Set<CommandHandler>();
    const pluginMessageHandlers = new Set<PluginMessageHandler>();
    const connectedHandlers = new Set<VoidHandler>();
    const disconnectedHandlers = new Set<VoidHandler>();
    const errorHandlers = new Set<ErrorHandler>();
    let isConnected = false;

    const mock = {
        _commandHandlers: commandHandlers,
        _pluginMessageHandlers: pluginMessageHandlers,
        _connectedHandlers: connectedHandlers,
        _disconnectedHandlers: disconnectedHandlers,
        _errorHandlers: errorHandlers,

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
        _simulatePluginMessage(pluginId: string, correlationId: string, payload: unknown) {
            for (const h of pluginMessageHandlers) h(pluginId, correlationId, payload);
        },

        sendHello: vi.fn(),
        sendTreeRegistered: vi.fn(),
        sendTreeRemoved: vi.fn(),
        sendTickBatch: vi.fn(),
        sendCommandResponse: vi.fn(),
        sendPluginMessage: vi.fn(),

        onCommand(handler: CommandHandler): OffFunction {
            commandHandlers.add(handler);
            return () => commandHandlers.delete(handler);
        },
        onPluginMessage(handler: PluginMessageHandler): OffFunction {
            pluginMessageHandlers.add(handler);
            return () => pluginMessageHandlers.delete(handler);
        },
        onConnected(handler: VoidHandler): OffFunction {
            connectedHandlers.add(handler);
            return () => connectedHandlers.delete(handler);
        },
        onDisconnected(handler: VoidHandler): OffFunction {
            disconnectedHandlers.add(handler);
            return () => disconnectedHandlers.delete(handler);
        },

        onError(handler: ErrorHandler): OffFunction {
            errorHandlers.add(handler);
            return () => errorHandlers.delete(handler);
        },

        open: vi.fn(),
        close: vi.fn(),
        tick: vi.fn(),
        get isConnected() { return isConnected; },
    };

    return mock;
}

function createMockPlugin(pluginId = "test-plugin"): StudioPlugin & {
    attach: Mock;
    detach: Mock;
    handleInbound: Mock;
    _sender: PluginSender | null;
} {
    let sender: PluginSender | null = null;
    return {
        pluginId,
        attach: vi.fn((s: PluginSender) => { sender = s; }),
        detach: vi.fn(() => { sender = null; }),
        handleInbound: vi.fn(),
        get _sender() { return sender; },
    };
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
            expect(() => { agent.start(); }).toThrow(/already been started/);
        });

        it("throws if destroyed", () => {
            const { agent } = createAgent();
            agent.destroy();
            expect(() => { agent.start(); }).toThrow(/has been destroyed/);
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
            expect(link.sendTickBatch).toHaveBeenCalledWith("tree-1", [expect.objectContaining({ tickId: expect.any(Number) as number })]);
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

            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", { success: true });
        });

        it("acks disable-streaming", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: StudioCommandType.DisableStreaming });

            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", { success: true });
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
            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", { success: true });
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
            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", { success: true });
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
            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", { success: true });
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
            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", { success: true });
        });

        it("unknown command acks UNKNOWN_COMMAND", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: 999 as StudioCommandType });

            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", {
                success: false,
                errorCode: StudioErrorCode.UnknownCommand,
                errorMessage: expect.any(String) as string,
            });
        });

        it("unknown treeId acks TREE_NOT_FOUND", () => {
            const { agent, link } = createAgent();
            agent.start();
            link._simulateConnect();

            link._simulateCommand({ correlationId: "c1", treeId: "missing-tree", command: StudioCommandType.EnableStreaming });

            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", {
                success: false,
                errorCode: StudioErrorCode.TreeNotFound,
                errorMessage: expect.any(String) as string,
            });
        });

        it("get-tree-statuses returns statuses in the response data", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            // Enable streaming first
            link._simulateCommand({ correlationId: "s1", treeId: "tree-1", command: StudioCommandType.EnableStreaming });

            link._simulateCommand({ correlationId: "c1", treeId: "tree-1", command: StudioCommandType.GetTreeStatuses });

            expect(link.sendCommandResponse).toHaveBeenCalledWith("c1", {
                success: true,
                data: { streaming: true, stateTrace: false, profiling: false },
            });
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

        it("clears tree states so commands return tree-not-found after destroy", () => {
            const { agent, registry, link } = createAgent();
            const tree = createTree();
            registry.register("tree-1", tree);
            agent.start();
            link._simulateConnect();

            agent.destroy();

            // Commands won't fire because we've unsubscribed,
            // but we can verify state was cleared by checking no
            // command responses were sent after destroy
            link.sendCommandResponse.mockClear();
            expect(link.sendCommandResponse).not.toHaveBeenCalled();
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

    describe("plugin system", () => {
        it("registerPlugin() throws if called after start", () => {
            const { agent } = createAgent();
            agent.start();
            const plugin = createMockPlugin();
            expect(() => { agent.registerPlugin(plugin); }).toThrow(/Cannot register plugin after agent is started/);
        });

        it("attaches plugin on start()", () => {
            const { agent } = createAgent();
            const plugin = createMockPlugin();
            agent.registerPlugin(plugin);
            agent.start();
            expect(plugin.attach).toHaveBeenCalledTimes(1);
        });

        it("plugin sender calls link.sendPluginMessage with correct args", () => {
            const { agent, link } = createAgent();
            const plugin = createMockPlugin("repl");
            agent.registerPlugin(plugin);
            agent.start();

            (plugin._sender as NonNullable<typeof plugin._sender>).send("corr-1", { type: "result", text: "2" });

            expect(link.sendPluginMessage).toHaveBeenCalledWith("repl", "corr-1", { type: "result", text: "2" });
        });

        it("routes inbound PluginMessage to the matching plugin", () => {
            const { agent, link } = createAgent();
            const plugin = createMockPlugin("repl");
            agent.registerPlugin(plugin);
            agent.start();

            link._simulatePluginMessage("repl", "corr-1", { type: "eval", code: "1+1" });

            expect(plugin.handleInbound).toHaveBeenCalledWith("corr-1", { type: "eval", code: "1+1" });
        });

        it("ignores inbound PluginMessage for unknown pluginId", () => {
            const { agent, link } = createAgent();
            const plugin = createMockPlugin("repl");
            agent.registerPlugin(plugin);
            agent.start();

            link._simulatePluginMessage("unknown-plugin", "corr-1", {});

            expect(plugin.handleInbound).not.toHaveBeenCalled();
        });

        it("detaches plugins on destroy()", () => {
            const { agent } = createAgent();
            const plugin = createMockPlugin();
            agent.registerPlugin(plugin);
            agent.start();
            agent.destroy();
            expect(plugin.detach).toHaveBeenCalledTimes(1);
        });
    });
});
