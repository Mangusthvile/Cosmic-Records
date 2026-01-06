import React from 'react';
import { Workspace, NotificationLogItem } from '../../types';
import { Info, AlertTriangle, CheckCircle, Activity } from 'lucide-react';

interface NotificationsWidgetProps {
    workspace: Workspace;
    onOpenNote: (id: string) => void;
}

const NotificationsWidget: React.FC<NotificationsWidgetProps> = ({ workspace, onOpenNote }) => {
    const logs = workspace.notificationLog || [];

    const getIcon = (type: NotificationLogItem['type']) => {
        switch (type) {
            case 'warning': return <AlertTriangle size={12} className="text-warning" />;
            case 'statusChange': return <Activity size={12} className="text-accent" />;
            case 'system': return <CheckCircle size={12} className="text-success" />;
            default: return <Info size={12} className="text-muted" />;
        }
    };

    if (logs.length === 0) {
        return <div className="p-4 text-center text-xs text-muted italic">No notifications yet.</div>;
    }

    return (
        <div className="h-full overflow-y-auto p-2 space-y-2">
            {logs.map(log => (
                <div 
                    key={log.id} 
                    className={`p-2 rounded border border-border bg-surface/40 flex gap-2 items-start
                        ${log.relatedNoteId ? 'cursor-pointer hover:bg-surface hover:border-accent/30' : ''}
                    `}
                    onClick={() => log.relatedNoteId && onOpenNote(log.relatedNoteId)}
                >
                    <div className="mt-0.5 flex-shrink-0">{getIcon(log.type)}</div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] leading-snug text-foreground break-words">{log.message}</div>
                        <div className="text-[9px] text-faint mt-1 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default NotificationsWidget;