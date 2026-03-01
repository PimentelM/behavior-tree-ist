import React from 'react';

export function EmptyState() {
    return (
        <div className="bt-empty-state">
            <div className="bt-empty-state__icon">🔍</div>
            <h2 className="bt-empty-state__heading">No tree selected</h2>
            <p className="bt-empty-state__description">
                Select a client and a behavior tree to start debugging.
            </p>
        </div>
    );
}
