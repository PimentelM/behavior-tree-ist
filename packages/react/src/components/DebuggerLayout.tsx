import { memo } from 'react';
import type { ReactNode } from 'react';

interface DebuggerLayoutProps {
  showSidebar: boolean;
  showTimeline: boolean;
  canvas: ReactNode;
  sidebar: ReactNode | null;
  timeline: ReactNode | null;
}

function DebuggerLayoutInner({
  showSidebar,
  showTimeline,
  canvas,
  sidebar,
  timeline,
}: DebuggerLayoutProps) {
  return (
    <div
      className={`bt-debugger-layout ${
        showSidebar ? 'bt-debugger-layout--with-sidebar' : ''
      }`}
      style={
        !showTimeline
          ? { gridTemplateRows: '1fr' }
          : undefined
      }
    >
      <div className="bt-debugger-layout__canvas">{canvas}</div>
      {showSidebar && sidebar && (
        <div className="bt-debugger-layout__sidebar">{sidebar}</div>
      )}
      {showTimeline && timeline && (
        <div className="bt-debugger-layout__timeline">{timeline}</div>
      )}
    </div>
  );
}

export const DebuggerLayout = memo(DebuggerLayoutInner);
