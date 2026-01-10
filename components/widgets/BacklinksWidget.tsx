
import React from 'react';
import { Workspace, Note, UnresolvedOrigin } from '../../types';
import { Link2, AlertTriangle, ArrowRight, XCircle } from 'lucide-react';
import { extractLinkTitles } from '../../services/linkService';
import { clearUnresolvedOrigins } from '../../services/storageService';
import { noteContentToPlainText } from '../../services/vaultService';

interface BacklinksWidgetProps {
    note: Note | null;
    workspace: Workspace;
    onOpenNote: (id: string) => void;
}

const BacklinksWidget: React.FC<BacklinksWidgetProps> = ({ note, workspace, onOpenNote }) => {
    if (!note) {
        return <div className="p-4 text-center text-xs text-muted italic">Select a note to view connections.</div>;
    }

    // 1. Incoming Links
    const incomingIds = workspace.indexes.backlinks[note.id] || [];
    const incomingNotes = incomingIds.map(id => workspace.notes[id]).filter(Boolean);

    // 2. Unresolved Sources (Persisted Metadata)
    const origins = (note.system?.unresolvedOrigins || []) as UnresolvedOrigin[];

    // 3. Outgoing Unresolved Links
    const plainText = noteContentToPlainText(note);
    const outgoingTitles = extractLinkTitles(plainText);
    const unresolvedOutgoing = outgoingTitles
        .map(t => {
            const id = workspace.indexes.title_to_note_id[t];
            if (!id) return null;
            const n = workspace.notes[id];
            return n && n.unresolved ? n : null;
        })
        .filter((n): n is Note => !!n);

    const handleClearOrigins = () => {
        if (confirm("Clear the list of origin links for this note? This does not delete the source notes.")) {
            clearUnresolvedOrigins(workspace, note.id);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto p-3 space-y-4">
            
            {/* STATUS ALERT */}
            {note.unresolved && (
                <div className="bg-danger/10 border border-danger/30 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-danger font-bold text-xs">
                            <AlertTriangle size={12} /> UNRESOLVED
                        </div>
                        {origins.length > 0 && (
                            <button 
                                onClick={handleClearOrigins}
                                className="text-[9px] text-danger hover:underline flex items-center gap-1"
                                title="Clear origin history"
                            >
                                <XCircle size={10} /> Clear
                            </button>
                        )}
                    </div>
                    
                    {origins.length > 0 && (
                        <div className="space-y-1 mt-2">
                            {origins.map((src, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => onOpenNote(src.sourceNoteId)}
                                    className="flex items-center gap-1 text-[10px] text-accent cursor-pointer hover:underline"
                                >
                                    <ArrowRight size={10} /> Created from {src.sourceNoteTitle}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* INCOMING LINKS */}
            <section>
                <div className="text-[10px] font-bold uppercase text-faint tracking-widest mb-2">
                    Incoming ({incomingNotes.length})
                </div>
                {incomingNotes.length === 0 ? (
                    <div className="text-xs text-muted italic ml-1">No incoming links.</div>
                ) : (
                    <div className="space-y-1">
                        {incomingNotes.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => onOpenNote(n.id)}
                                className="p-2 bg-surface border border-border rounded cursor-pointer hover:border-accent/50 transition-all text-xs truncate"
                            >
                                {n.title}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* OUTGOING UNRESOLVED */}
            {unresolvedOutgoing.length > 0 && (
                <section>
                        <div className="text-[10px] font-bold uppercase text-warning tracking-widest mb-2 flex items-center gap-2">
                        <AlertTriangle size={10} /> Unresolved Outgoing
                    </div>
                    <div className="space-y-1">
                            {unresolvedOutgoing.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => onOpenNote(n.id)}
                                className="p-2 bg-surface border border-warning/30 rounded cursor-pointer hover:bg-warning/10 transition-all text-xs truncate text-warning"
                            >
                                {n.title}
                            </div>
                        ))}
                    </div>
                </section>
            )}

        </div>
    );
};

export default BacklinksWidget;
