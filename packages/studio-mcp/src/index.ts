import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTRPCClient, httpLink } from '@trpc/client';
import { z } from 'zod';
import type { AppRouter } from '@bt-studio/studio-server';
import { loadConfig } from './config';
import { SessionManager } from './session-manager';
import {
    handleGetPublicKey,
    handleListAgents,
    handleEval,
    handleCompletions,
} from './tools';

async function main(): Promise<void> {
    const config = loadConfig();

    const trpc = createTRPCClient<AppRouter>({
        links: [httpLink({ url: `${config.serverUrl}/trpc` })],
    });

    const sessions = new SessionManager(config.privateKey, trpc);

    const server = new McpServer({ name: 'bt-studio-mcp', version: '0.1.0' });

    server.registerTool(
        'get_public_key',
        {
            description:
                "Returns the MCP server's NaCl public key (base64url). " +
                'Use this to configure agents with the correct ReplPlugin public key.',
        },
        () => handleGetPublicKey(sessions),
    );

    server.registerTool(
        'list_agents',
        {
            description:
                'List all agents registered with the studio server, including online status and REPL readiness.',
        },
        () => handleListAgents(trpc),
    );

    server.registerTool(
        'eval',
        {
            description:
                "Evaluate JavaScript code on a connected agent's REPL. " +
                'If only one agent is online, it is selected automatically.',
            inputSchema: {
                code: z.string().describe('JavaScript code to evaluate on the agent.'),
                clientId: z
                    .string()
                    .optional()
                    .describe('Agent client ID. Optional if exactly one agent is online.'),
                sessionId: z
                    .string()
                    .optional()
                    .describe('Agent session ID. Required if clientId is provided.'),
                timeout: z
                    .number()
                    .optional()
                    .describe('Timeout in milliseconds (default: 15000).'),
            },
        },
        (args) => handleEval(trpc, sessions, config, args),
    );

    server.registerTool(
        'completions',
        {
            description:
                "Get tab-completion suggestions from a connected agent's REPL. " +
                'If only one agent is online, it is selected automatically.',
            inputSchema: {
                prefix: z.string().describe('The code prefix to complete.'),
                clientId: z
                    .string()
                    .optional()
                    .describe('Agent client ID. Optional if exactly one agent is online.'),
                sessionId: z
                    .string()
                    .optional()
                    .describe('Agent session ID. Required if clientId is provided.'),
                maxResults: z
                    .number()
                    .optional()
                    .describe('Maximum number of completions to return.'),
            },
        },
        (args) => handleCompletions(trpc, sessions, config, args),
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err: unknown) => {
    process.stderr.write(`[bt-studio-mcp] Fatal error: ${String(err)}\n`);
    process.exit(1);
});
