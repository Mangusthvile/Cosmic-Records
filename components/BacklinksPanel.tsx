
import React from 'react';
import { Workspace, Note, UnresolvedOrigin } from '../types';
import { Link2, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { extractLinkTitles } from '../services/linkService';

interface BacklinksPanelProps {
    currentNote: Note | null;
    workspace: Workspace;
    onOpenNote: (id: string) => void;
    onClose?: () => void;
}

const BacklinksPanel: React.FC<BacklinksPanelProps> = ({ currentNote, workspace, onOpenNote, onClose }) => {
    if (!currentNote) {
        return (
            <div className="flex flex-col h-full bg-chrome-panel border-l border-chrome-border p-8 text-center justify-center">
                <Link2 size={32} className="mx-auto mb-4 text-faint" />
                <div className="text-muted text-xs">Select a note to view connections.</div>
            </div>
        );
    }

    // 1. Incoming Links (Backlinks)
    const incomingIds = workspace.indexes.backlinks[currentNote.id] || [];
    const incomingNotes = incomingIds.map(id => workspace.notes[id]).filter(Boolean);

    // 2. Unresolved Sources (Persisted Metadata)
    const origins = (currentNote.system?.unresolvedOrigins || []) as UnresolvedOrigin[];

    // 3. Outgoing Unresolved Links (If this note points to unresolved stuff)
    const outgoingTitles = extractLinkTitles(currentNote.content || "");
    const unresolvedOutgoing = outgoingTitles
        .map(t => {
            const id = workspace.indexes.title_to_note_id[t];
            if (!id) return null; // Should ideally be created, but if missing entirely, ignore
            const n = workspace.notes[id];
            return n && n.unresolved ? n : null;
        })
        .filter((n): n is Note => !!n);

    return (
        <div className="flex flex-col h-full bg-chrome-panel border-l border-chrome-border">
            {/* Header */}
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-3 border-b border-chrome-border bg-chrome-panel">
                 <div className="flex items-center gap-2 text-accent font-mono text-[var(--fs-sm)] font-bold">
                    <Link2 size={14} />
                    <span className="truncate">CONNECTIONS</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
                        <X size={14} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* STATUS ALERT */}
                {currentNote.unresolved && (
                    <div className="bg-danger/10 border border-danger/30 rounded p-3">
                        <div className="flex items-center gap-2 text-danger font-bold text-xs mb-2">
                            <AlertTriangle size={14} /> UNRESOLVED NOTE
                        </div>
                        <div className="text-[10px] text-muted mb-2">
                            This note was auto-created from a link.
                        </div>
                        {origins.length > 0 && (
                            <div>
                                <div className="text-[10px] uppercase text-faint font-bold mb-1">Created From:</div>
                                <div className="space-y-1">
                                    {origins.map((src, idx) => (
                                        <div 
                                            key={idx}
                                            onClick={() => onOpenNote(src.sourceNoteId)}
                                            className="flex items-center gap-1 text-xs text-accent cursor-pointer hover:underline"
                                        >
                                            <ArrowRight size={10} /> {src.sourceNoteTitle}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* INCOMING LINKS */}
                <section>
                    <div className="text-[10px] font-bold uppercase text-faint tracking-widest mb-2 flex items-center justify-between">
                        <span>Incoming ({incomingNotes.length})</span>
                    </div>
                    {incomingNotes.length === 0 ? (
                        <div className="text-xs text-muted italic">No incoming links.</div>
                    ) : (
                        <div className="space-y-1">
                            {incomingNotes.map(note => (
                                <div 
                                    key={note.id} 
                                    onClick={() => onOpenNote(note.id)}
                                    className="p-2 bg-surface border border-border rounded cursor-pointer hover:border-accent/50 transition-all text-xs"
                                >
                                    <div className="font-bold text-foreground truncate">{note.title}</div>
                                    <div className="text-[10px] text-faint mt-0.5 uppercase">{note.type}</div>
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
                             {unresolvedOutgoing.map(note => (
                                <div 
                                    key={note.id} 
                                    onClick={() => onOpenNote(note.id)}
                                    className="p-2 bg-surface border border-warning/30 rounded cursor-pointer hover:bg-warning/10 transition-all text-xs"
                                >
                                    <div className="font-bold text-warning truncate">{note.title}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

            </div>
        </div>
    );
};

export default BacklinksPanel;
