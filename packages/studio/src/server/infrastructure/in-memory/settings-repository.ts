import { SettingsRepository, ServerSettings } from "../../domain";

export class InMemorySettingsRepository implements SettingsRepository {
    private settings: ServerSettings = {
        maxTickRecordsPerTree: 10000
    };

    get(): ServerSettings {
        return { ...this.settings };
    }

    update(settings: Partial<ServerSettings>): ServerSettings {
        this.settings = {
            ...this.settings,
            ...settings
        };
        return { ...this.settings };
    }
}
