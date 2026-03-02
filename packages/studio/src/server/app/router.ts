import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
    ClientRepository,
    TreeRepository,
    TickRepository,
    SettingsRepository,
    StudioService,
} from "../domain";
import { CommandType } from "@behavior-tree-ist/studio-transport";

export type RouterContext = {
    clientRepo: ClientRepository;
    treeRepo: TreeRepository;
    tickRepo: TickRepository;
    settingsRepo: SettingsRepository;
    service: StudioService;
};

const t = initTRPC.context<RouterContext>().create();

export const appRouter = t.router({
    getClients: t.procedure.query(({ ctx }) => {
        return ctx.clientRepo.findAll();
    }),

    getTrees: t.procedure
        .input(z.object({ clientId: z.string() }))
        .query(({ ctx, input }) => {
            return ctx.treeRepo.findByClient(input.clientId);
        }),

    getTree: t.procedure
        .input(z.object({ clientId: z.string(), treeId: z.string() }))
        .query(({ ctx, input }) => {
            return ctx.treeRepo.find(input.clientId, input.treeId);
        }),

    getTicks: t.procedure
        .input(z.object({
            clientId: z.string(),
            treeId: z.string(),
            afterTickId: z.number().optional(),
            limit: z.number().optional()
        }))
        .query(({ ctx, input }) => {
            return ctx.tickRepo.query(input.clientId, input.treeId, input.afterTickId, input.limit);
        }),

    getSettings: t.procedure.query(({ ctx }) => {
        return ctx.settingsRepo.get();
    }),

    updateSettings: t.procedure
        .input(z.object({
            maxTickRecordsPerTree: z.number().optional()
        }))
        .mutation(({ ctx, input }) => {
            return ctx.settingsRepo.update(input);
        }),

    enableStreaming: t.procedure
        .input(z.object({ clientId: z.string(), treeId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.service.enableStreaming(input.clientId, input.treeId);
        }),

    disableStreaming: t.procedure
        .input(z.object({ clientId: z.string(), treeId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return ctx.service.disableStreaming(input.clientId, input.treeId);
        }),

    sendCommand: t.procedure
        .input(z.object({
            clientId: z.string(),
            treeId: z.string(),
            command: z.enum([
                CommandType.EnableStreaming,
                CommandType.DisableStreaming,
                CommandType.EnableStateTrace,
                CommandType.DisableStateTrace,
                CommandType.EnableProfiling,
                CommandType.DisableProfiling,
            ] as const),
        }))
        .mutation(async ({ ctx, input }) => {
            return ctx.service.sendCommand(input.clientId, input.treeId, input.command);
        }),

    deleteClient: t.procedure
        .input(z.object({ clientId: z.string() }))
        .mutation(({ ctx, input }) => {
            ctx.service.deleteClient(input.clientId);
            return { success: true };
        }),
});

export type AppRouter = typeof appRouter;
