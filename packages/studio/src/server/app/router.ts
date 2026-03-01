import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
    ClientRepository,
    TreeRepository,
    TickRepository,
    SettingsRepository,
    StudioService
} from "../domain";

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
            await ctx.service.enableStreaming(input.clientId, input.treeId);
            return { success: true };
        }),

    disableStreaming: t.procedure
        .input(z.object({ clientId: z.string(), treeId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.service.disableStreaming(input.clientId, input.treeId);
            return { success: true };
        }),
});

export type AppRouter = typeof appRouter;
