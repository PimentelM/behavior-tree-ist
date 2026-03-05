import { memo, useCallback } from 'react';
import type { StudioControls } from '../../types';

interface AttachDrawerProps {
  controls: StudioControls;
  onClose: () => void;
}

function formatTimestamp(ts: number): string {
  const d = new Date(Math.abs(ts) >= 1e12 ? ts : ts * 1000);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  const ss = `${d.getSeconds()}`.padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function AttachDrawerInner({ controls, onClose }: AttachDrawerProps) {
  const {
    clients, sessions, trees,
    expandedClientId, onExpandClient,
    expandedSessionId, onExpandSession,
    onSelectionChange,
    loadingClients, loadingSessions, loadingTrees,
  } = controls;

  const handleSelectTree = useCallback((clientId: string, sessionId: string, treeId: string) => {
    onSelectionChange({ clientId, sessionId, treeId });
    onClose();
  }, [onSelectionChange, onClose]);

  const handleClickClient = useCallback((clientId: string) => {
    if (expandedClientId === clientId) {
      onExpandClient(null);
      onExpandSession(null);
    } else {
      onExpandClient(clientId);
      onExpandSession(null);
    }
  }, [expandedClientId, onExpandClient, onExpandSession]);

  const handleClickSession = useCallback((sessionId: string) => {
    if (expandedSessionId === sessionId) {
      onExpandSession(null);
    } else {
      onExpandSession(sessionId);
    }
  }, [expandedSessionId, onExpandSession]);

  const clientSessions = expandedClientId
    ? sessions.filter((s) => s.clientId === expandedClientId)
    : [];

  const sessionTrees = expandedSessionId
    ? trees.filter((t) => t.sessionId === expandedSessionId && !t.removedAt)
    : [];

  return (
    <div className="bt-studio-drawer">
      <div className="bt-studio-drawer__header">
        <span className="bt-studio-drawer__title">Attach to Tree</span>
        <button
          type="button"
          className="bt-studio-drawer__close"
          onClick={onClose}
          aria-label="Close attach drawer"
        >
          &times;
        </button>
      </div>
      <div className="bt-studio-drawer__body">
        {loadingClients && <div className="bt-studio-drawer__loading">Loading clients...</div>}
        {!loadingClients && clients.length === 0 && (
          <div className="bt-studio-drawer__empty">No clients connected</div>
        )}
        <ul className="bt-studio-drawer__list">
          {clients.map((client) => {
            const expanded = expandedClientId === client.clientId;
            return (
              <li key={client.clientId} className="bt-studio-drawer__item">
                <button
                  type="button"
                  className={`bt-studio-drawer__row ${expanded ? 'bt-studio-drawer__row--expanded' : ''}`}
                  onClick={() => handleClickClient(client.clientId)}
                >
                  <span className={`bt-studio-drawer__dot bt-studio-drawer__dot--${client.status}`} />
                  <span className="bt-studio-drawer__row-label">{client.clientId}</span>
                  <span className="bt-studio-drawer__row-time">{formatTimestamp(client.lastSeenAt)}</span>
                  <span className="bt-studio-drawer__chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                </button>

                {expanded && (
                  <ul className="bt-studio-drawer__sublist">
                    {loadingSessions && <li className="bt-studio-drawer__loading">Loading sessions...</li>}
                    {!loadingSessions && clientSessions.length === 0 && (
                      <li className="bt-studio-drawer__empty">No sessions</li>
                    )}
                    {clientSessions.map((session) => {
                      const sesExpanded = expandedSessionId === session.sessionId;
                      return (
                        <li key={session.sessionId} className="bt-studio-drawer__item">
                          <button
                            type="button"
                            className={`bt-studio-drawer__row bt-studio-drawer__row--session ${sesExpanded ? 'bt-studio-drawer__row--expanded' : ''}`}
                            onClick={() => handleClickSession(session.sessionId)}
                          >
                            <span className={`bt-studio-drawer__dot bt-studio-drawer__dot--${session.online ? 'online' : 'offline'}`} />
                            <span className="bt-studio-drawer__row-label">{session.sessionId}</span>
                            {session.online && <span className="bt-studio-drawer__badge">online</span>}
                            <span className="bt-studio-drawer__chevron" aria-hidden="true">{sesExpanded ? '▾' : '▸'}</span>
                          </button>

                          {sesExpanded && (
                            <ul className="bt-studio-drawer__sublist">
                              {loadingTrees && <li className="bt-studio-drawer__loading">Loading trees...</li>}
                              {!loadingTrees && sessionTrees.length === 0 && (
                                <li className="bt-studio-drawer__empty">No trees</li>
                              )}
                              {sessionTrees.map((tree) => (
                                <li key={tree.treeId} className="bt-studio-drawer__item">
                                  <button
                                    type="button"
                                    className="bt-studio-drawer__row bt-studio-drawer__row--tree"
                                    onClick={() => handleSelectTree(tree.clientId, tree.sessionId, tree.treeId)}
                                  >
                                    <span className="bt-studio-drawer__row-label">{tree.treeId}</span>
                                    <span className="bt-studio-drawer__row-time">{formatTimestamp(tree.updatedAt)}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export const AttachDrawer = memo(AttachDrawerInner);
