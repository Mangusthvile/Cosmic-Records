
import React, { useEffect, useState } from 'react';
import { Workspace, GlossaryTerm } from '../../types';
import { Search, Book, BookOpen } from 'lucide-react';
import { createGlossaryTerm, addPendingTerm } from '../../services/storageService';
import { noteContentToPlainText } from '../../services/vaultService';
import { WidgetProps } from './WidgetRegistry';

const GlossaryWidget: React.FC<WidgetProps> = ({ workspace, onUpdateWorkspace, state, onStateChange }) => {
    const search = state?.search || '';
    const view = state?.view || 'search'; // 'search' | 'details'
    const selectedTermId = state?.selectedTermId || null;

    const updateState = (partial: any) => onStateChange({ ...state, ...partial });

    // Listener for glossary interactions
    useEffect(() => {
        const handleHover = (e: CustomEvent) => {
            const termId = e.detail.termId;
            updateState({ selectedTermId: termId, view: 'details' });
        };
        const handleClick = (e: CustomEvent) => {
            const termId = e.detail.termId;
            updateState({ selectedTermId: termId, view: 'details' });
            // Ideally we also open the tab, but the widget just shows detail for now
        };
        
        window.addEventListener('glossary-hover', handleHover as any);
        window.addEventListener('glossary-click', handleClick as any);
        return () => {
            window.removeEventListener('glossary-hover', handleHover as any);
            window.removeEventListener('glossary-click', handleClick as any);
        };
    }, []);

    const selectedTerm = selectedTermId ? workspace.glossary.terms[selectedTermId] : null;

    const handleAddPending = () => {
        if (!search) return;
        addPendingTerm(workspace, search);
        onUpdateWorkspace({ ...workspace });
        updateState({ search: '' });
    };

    const renderDetails = () => {
        if (!selectedTerm) return <div className="p-4 text-xs italic text-muted">Term not found.</div>;
        
        const plainDef = noteContentToPlainText({ content: selectedTerm.definitionRichText });

        return (
            <div className="flex flex-col h-full p-3 space-y-3 overflow-y-auto">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <BookOpen size={16} className="text-accent" />
                        <h3 className="text-sm font-bold text-text">{selectedTerm.primaryName}</h3>
                    </div>
                    {selectedTerm.aliases.length > 0 && (
                        <div className="text-[10px] text-text2 flex gap-1">
                            {selectedTerm.aliases.map(a => <span key={a} className="bg-panel2 border border-border px-1 rounded">{a}</span>)}
                        </div>
                    )}
                </div>
                
                <div className="flex flex-wrap gap-1">
                    {selectedTerm.universeScopes.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                            {tag}
                        </span>
                    ))}
                </div>

                <div className="text-xs text-text2 leading-relaxed whitespace-pre-wrap">
                    {plainDef || "No definition provided."}
                </div>

                <div className="mt-auto pt-4 border-t border-border">
                    <button 
                        onClick={() => updateState({ view: 'search' })}
                        className="text-[10px] text-muted hover:text-text"
                    >
                        &larr; Back to Search
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
             {view === 'details' ? renderDetails() : (
                <div className="flex flex-col h-full">
                    <div className="p-2 border-b border-border bg-surface/30">
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                            <input 
                                className="w-full bg-surface border border-border rounded pl-7 pr-2 py-1 text-xs focus:outline-none focus:border-accent"
                                placeholder="Search definitions..."
                                value={search}
                                onChange={(e) => updateState({ search: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {search && (
                            <div className="p-2 border border-dashed border-border rounded flex flex-col gap-2 mb-2">
                                <span className="text-[10px] text-text2">Not found? Suggest it:</span>
                                <button 
                                    onClick={handleAddPending}
                                    className="bg-panel2 hover:bg-surface text-xs font-bold py-1 rounded border border-border transition-colors"
                                >
                                    Suggest "{search}"
                                </button>
                            </div>
                        )}
                        {/* List could go here, but focusing on definer role */}
                        <div className="text-center text-[10px] text-muted italic mt-4">
                            Hover over a term link in the editor to see its definition here.
                        </div>
                    </div>
                </div>
             )}
        </div>
    );
};

export default GlossaryWidget;
