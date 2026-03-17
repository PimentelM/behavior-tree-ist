interface CompletionOverlayProps {
    candidates: string[];
    selectedIndex: number;
    x: number;
    y: number;
    onSelect: (candidate: string) => void;
    onDismiss: () => void;
}

export function CompletionOverlay({ candidates, selectedIndex, x, y, onSelect, onDismiss }: CompletionOverlayProps) {
    return (
        <>
            {/* Click-outside backdrop */}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onMouseDown={onDismiss}
            />
            <div
                style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    zIndex: 1000,
                    background: '#1a1a1a',
                    border: '1px solid #333333',
                    borderRadius: 4,
                    maxHeight: 200,
                    overflowY: 'auto',
                    minWidth: 120,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}
            >
                {candidates.map((candidate, i) => (
                    <div
                        key={candidate}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(candidate);
                        }}
                        style={{
                            padding: '3px 10px',
                            fontFamily: 'Menlo, Consolas, monospace',
                            fontSize: 13,
                            color: i === selectedIndex ? '#5af78e' : '#e0e0e0',
                            background: i === selectedIndex ? '#2a2a2a' : 'transparent',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {candidate}
                    </div>
                ))}
            </div>
        </>
    );
}
