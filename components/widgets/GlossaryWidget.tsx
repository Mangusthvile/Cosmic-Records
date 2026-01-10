
import React from 'react';
import { Workspace, GlossaryTerm } from '../../types';
import { Search, Book, Plus, ExternalLink } from 'lucide-react';
import { glossaryService } from '../../services/glossaryService';
import { WidgetProps } from './WidgetRegistry';
import { Button } from '../ui/Primitives';

const GlossaryWidget: React.FC<WidgetProps> = ({ workspace, onUpdateWorkspace, state, onStateChange, onOpenNote }) => {
    const search = state?.search || '';
    const view = state?.view || 'search'; // 'search' | 'define' | 'details'
    const selectedTermId = state?.selectedTermId;

    const updateState = (partial: any) => onStateChange({ ...state, ...partial });

    const terms = (Object.values(workspace.glossary.terms) as GlossaryTerm[]);
    const filtered = terms.filter(t => t.term.toLowerCase().includes(search.toLowerCase()) || t.aliases.some(a => a.toLowerCase().includes(search.toLowerCase())));

    const handleCreatePending = () => {
        if (!search.trim()) return;
        glossaryService.addPending(workspace, search.trim());
        onUpdateWorkspace({ ...workspace });
        alert(`Added "${search}" to pending terms.`);
    };

    const handleSelectTerm = (id: string) => {
        updateState({ selectedTermId: id, view: 'details' });
    };

    // Render Detail View
    if (view === 'details' && selectedTermId) {
        const term = workspace.glossary.terms[selectedTermId];
        if (!term) return <div className="p-4 text-xs text-muted">Term not found. <button onClick={() => updateState({ view: 'search' })} className="underline">Back</button></div>;

        return (
            <div className="flex flex-col h-full bg-deep-space">
                <div className="p-3 border-b border-border bg-panel flex items-center justify-between">
                    <button onClick={() => updateState({ view: 'search' })} className="text-xs text-accent hover:underline">← Back</button>
                    <div className="flex gap-2">
                        {/* If we had a way to trigger open tab from here... passed via props? onOpenNote handles IDs... special ID? */}
                        {/* We reuse onOpenNote to signal opening the Glossary Entry Tab if we detect the ID format or modify handler */}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <h2 className="text-xl font-bold text-accent mb-1">{term.term}</h2>
                    {term.aliases.length > 0 && <div className="text-xs text-text2 italic mb-4">aka: {term.aliases.join(', ')}</div>}
                    
                    <div className="text-sm text-text leading-relaxed whitespace-pre-wrap mb-4">
                        {term.definition_plain || "No definition content."}
                    </div>

                    {term.universeTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-4">
                            {term.universeTags.map(t => (
                                <span key={t} className="px-2 py-1 rounded bg-panel border border-border text-[10px] text-text2">{t}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b border-border bg-surface/30">
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                    <input 
                        className="w-full bg-surface border border-border rounded pl-7 pr-2 py-1 text-xs focus:outline-none focus:border-accent"
                        placeholder="Define term..."
                        value={search}
                        onChange={(e) => updateState({ search: e.target.value })}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filtered.length === 0 ? (
                    <div className="text-center mt-4">
                        <div className="text-xs text-muted italic mb-2">No matches found.</div>
                        {search.trim() && (
                            <Button size="sm" onClick={handleCreatePending} className="mx-auto">
                                <Plus size={12} className="mr-1"/> Add to Pending
                            </Button>
                        )}
                    </div>
                ) : (
                    filtered.map(term => (
                        <div 
                            key={term.id} 
                            onClick={() => handleSelectTerm(term.id)}
                            className="p-2 border border-border rounded bg-surface/50 hover:bg-surface cursor-pointer group"
                        >
                            <div className="text-xs font-bold text-foreground group-hover:text-accent">{term.term}</div>
                            <div className="text-[10px] text-muted mt-1 leading-snug line-clamp-2">{term.definition_plain}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default GlossaryWidget;
