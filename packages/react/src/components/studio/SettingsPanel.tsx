import { memo, useState, useCallback, type KeyboardEvent } from 'react';
import type { StudioServerSettings, StudioUiSettings } from '../../types';

interface SettingsPanelProps {
  serverSettings: StudioServerSettings | null;
  uiSettings: StudioUiSettings;
  onServerSettingsChange: (patch: Partial<StudioServerSettings>) => void;
  onUiSettingsChange: (patch: Partial<StudioUiSettings>) => void;
  onClose: () => void;
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  helpText?: string;
}

function NumberField({ label, value, onChange, min = 1, helpText }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  const commit = useCallback(() => {
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed) && parsed >= min) {
      onChange(parsed);
    } else {
      setDraft(String(value));
    }
  }, [draft, min, onChange, value]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
  }, [commit]);

  return (
    <div className="bt-studio-settings__field-group">
      <label className="bt-studio-settings__field">
        <span className="bt-studio-settings__field-label">{label}</span>
        <input
          type="number"
          className="bt-studio-settings__number-input"
          value={draft}
          min={min}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </label>
      {helpText && <span className="bt-studio-settings__field-help">{helpText}</span>}
    </div>
  );
}

function SettingsPanelInner({ serverSettings, uiSettings, onServerSettingsChange, onUiSettingsChange, onClose }: SettingsPanelProps) {
  return (
    <div className="bt-studio-settings">
      <div className="bt-studio-settings__header">
        <span className="bt-studio-settings__title">Settings</span>
        <button
          type="button"
          className="bt-studio-settings__close"
          onClick={onClose}
          aria-label="Close settings"
        >
          &times;
        </button>
      </div>
      <div className="bt-studio-settings__body">
        <div className="bt-studio-settings__section">
          <h4 className="bt-studio-settings__section-title">UI Settings</h4>
          <NumberField
            label="Ring Buffer Size"
            value={uiSettings.ringBufferSize}
            onChange={(v) => onUiSettingsChange({ ringBufferSize: v })}
            helpText="Number of ticks kept in memory for live streaming"
          />
          <NumberField
            label="Window Size"
            value={uiSettings.windowSize}
            onChange={(v) => onUiSettingsChange({ windowSize: v })}
            min={100}
            helpText="Target ticks to keep loaded for time travel (1000–10000)"
          />
          <NumberField
            label="Fetch Batch Size"
            value={uiSettings.fetchBatchSize}
            onChange={(v) => onUiSettingsChange({ fetchBatchSize: v })}
            min={100}
            helpText="How many ticks to fetch per windowed request"
          />
          <NumberField
            label="Poll Rate (ms)"
            value={uiSettings.pollRateMs}
            onChange={(v) => onUiSettingsChange({ pollRateMs: v })}
            min={50}
            helpText="How often the UI polls the server for new ticks"
          />
          <div className="bt-studio-settings__field-group">
            <label className="bt-studio-settings__checkbox-field">
              <input
                type="checkbox"
                checked={uiSettings.showTreeSelectorInToolbar}
                onChange={(e) => onUiSettingsChange({ showTreeSelectorInToolbar: e.target.checked })}
              />
              <span>Show Tree Selector in Toolbar</span>
            </label>
            <span className="bt-studio-settings__field-help">Display tree picker inline in the toolbar</span>
          </div>
        </div>

        {serverSettings && (
          <div className="bt-studio-settings__section">
            <h4 className="bt-studio-settings__section-title">Server Settings</h4>
            <NumberField
              label="Max Ticks / Tree"
              value={serverSettings.maxTicksPerTree}
              onChange={(v) => onServerSettingsChange({ maxTicksPerTree: v })}
              helpText="Maximum ticks the server stores per tree"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export const SettingsPanel = memo(SettingsPanelInner);
