import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySettingsRepository } from "./settings-repository";

describe("InMemorySettingsRepository", () => {
    let repo: InMemorySettingsRepository;

    beforeEach(() => {
        repo = new InMemorySettingsRepository();
    });

    it("returns default settings", () => {
        const settings = repo.get();
        expect(settings).toBeDefined();
        expect(settings.maxTickRecordsPerTree).toBe(10000);
    });

    it("updates settings", () => {
        repo.update({ maxTickRecordsPerTree: 50 });
        const settings = repo.get();
        expect(settings.maxTickRecordsPerTree).toBe(50);
    });

    it("returns a copy to avoid mutation", () => {
        const settings = repo.get();
        settings.maxTickRecordsPerTree = 999;

        const again = repo.get();
        expect(again.maxTickRecordsPerTree).toBe(10000);
    });
});
