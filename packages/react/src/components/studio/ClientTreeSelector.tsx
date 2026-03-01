import { type ChangeEvent } from 'react';
import type { StudioClient, StudioTreeInfo, StudioProps } from '../../types';

export interface ClientTreeSelectorProps {
    clients: StudioClient[];
    trees: StudioTreeInfo[];
    selectedClientId: string | null;
    selectedTreeId: string | null;
    onSelectClient: (clientId: string) => void;
    onSelectTree: (treeId: string) => void;
}

export function ClientTreeSelector({
    clients,
    trees,
    selectedClientId,
    selectedTreeId,
    onSelectClient,
    onSelectTree,
}: ClientTreeSelectorProps) {
    const handleClientChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value) {
            onSelectClient(value);
        }
    };

    const handleTreeChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value) {
            onSelectTree(value);
        }
    };

    return (
        <div className="bt-studio-selector">
            <select
                className="bt-studio-selector__select"
                value={selectedClientId ?? ""}
                onChange={handleClientChange}
                aria-label="Select client"
            >
                <option value="" disabled>Select Client</option>
                {clients.map(client => (
                    <option key={client.clientId} value={client.clientId}>
                        {client.clientId} {client.isOnline ? '(Online)' : '(Offline)'}
                    </option>
                ))}
            </select>

            <select
                className="bt-studio-selector__select"
                value={selectedTreeId ?? ""}
                onChange={handleTreeChange}
                disabled={!selectedClientId}
                aria-label="Select tree"
            >
                <option value="" disabled>Select Tree</option>
                {trees.map(tree => (
                    <option key={tree.treeId} value={tree.treeId}>
                        {tree.treeId}
                    </option>
                ))}
            </select>
        </div>
    );
}
