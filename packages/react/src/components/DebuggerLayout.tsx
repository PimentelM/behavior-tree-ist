import { memo } from 'react';
import type { ReactNode } from 'react';

interface DebuggerLayoutProps {
  showToolbar: boolean;
  showSidebar: boolean;
  showTimeline: boolean;
  showActivityPanel: boolean;
  toolbar: ReactNode | null;
  activityPanel: ReactNode | null;
  canvas: ReactNode;
  sidebar: ReactNode | null;
  timeline: ReactNode | null;
}

function DebuggerLayoutInner({
  showToolbar,
  showSidebar,
  showTimeline,
  showActivityPanel,
  toolbar,
  activityPanel,
  canvas,
  sidebar,
  timeline,
}: DebuggerLayoutProps) {
  return (
    <div
      className={`bt-debugger-layout ${
        showSidebar ? 'bt-debugger-layout--with-sidebar' : ''
      } ${
        showToolbar ? 'bt-debugger-layout--with-toolbar' : 'bt-debugger-layout--no-toolbar'
      } ${
        showTimeline ? 'bt-debugger-layout--with-timeline' : 'bt-debugger-layout--no-timeline'
      } ${
        showActivityPanel ? 'bt-debugger-layout--with-activity' : ''
      }`}
    >
      {showToolbar && toolbar && (
        <div className="bt-debugger-layout__toolbar">{toolbar}</div>
      )}
      {showActivityPanel && activityPanel && (
        <div className="bt-debugger-layout__activity">{activityPanel}</div>
      )}
      <div className="bt-debugger-layout__canvas">
        {canvas}
      </div>
      {showSidebar && sidebar && (
        <div className="bt-debugger-layout__sidebar">
          {sidebar}
        </div>
      )}
      {showTimeline && timeline && (
        <div className="bt-debugger-layout__timeline">
          {timeline}
        </div>
      )}
    </div>
  );
}

export const DebuggerLayout = memo(DebuggerLayoutInner);
