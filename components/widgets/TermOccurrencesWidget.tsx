
import React from 'react';
import { WidgetProps } from './WidgetRegistry';
import { MessageSquare, ArrowRight, Quote } from 'lucide-react';

interface TermOccurrencesState {
    selectedTermId: string | null;
}

const TermOccurrencesWidget: React.FC<WidgetProps> = ({ workspace, onOpenNote, state }) => {
    const { selectedTermId } = (state || {}) as TermOccurrencesState;
    
    // Fallback or empty state
    if (!selectedTermId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted p-4 text-center space-y-2">
                <MessageSquare size={24} className="opacity-30" />
                <p className="text-xs italic">Select a term to see where it appears.</p>
            </div>
        );
    }

    const term = workspace.glossary.terms[selectedTermId];
    const occurrences = workspace.glossary.occurrences.terms[selectedTermId];
    
    if (!occurrences || occurrences.noteIds.length === 0) {
        return (
            <div className="flex flex-col h-full bg-panel text-text">
                <div className="p-3 border-b border-border bg-panel2/50 font-bold text-xs truncate">
                    Mentions: {term?.primaryName || 'Unknown'}
                </div>
                <div className="flex-1 flex items-center justify-center text-xs text-text2 italic p-4 text-center">
                    No mentions found in indexed notes.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-panel text-text overflow-hidden">
            <div className="p-3 border-b border-border bg-panel2/50 flex justify-between items-center flex-shrink-0">
                <span className="font-bold text-xs truncate mr-2">Mentions: <span className="text-accent">{term?.primaryName}</span></span>
                <span className="text-[10px] bg-surface px-1.5 rounded text-text2">{occurrences.noteIds.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                {occurrences.noteIds.map(noteId => {
                    const note = workspace.notes[noteId];
                    if (!note) return null; // Stale index check
                    
                    const snippets = occurrences.snippetsByNote[noteId] || [];

                    return (
                        <div key={noteId} className="flex flex-col gap-1.5 p-2 rounded bg-surface/30 border border-transparent hover:border-border transition-colors">
                            <button 
                                onClick={() => onOpenNote(noteId)}
                                className="flex items-center gap-1.5 text-xs font-bold text-accent hover:underline text-left w-full"
                            >
                                <ArrowRight size={12} className="flex-shrink-0" /> 
                                <span className="truncate">{note.title}</span>
                            </button>
                            
                            {snippets.map((snip, idx) => (
                                <div key={idx} className="text-[10px] text-text2 leading-relaxed border-l-2 border-border pl-2 italic opacity-80">
                                    <Quote size={8} className="inline mr-1 opacity-50" />
                                    {snip}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TermOccurrencesWidget;
