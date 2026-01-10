import React from 'react';
import { GlossaryTab, Workspace, GlossaryTerm } from '../types';
import { Search, Book } from 'lucide-react';
import { noteContentToPlainText } from '../services/vaultService';

interface GlossaryViewProps {
    tab: GlossaryTab;
    workspace: Workspace;
    onUpdateState: (partial: Partial<GlossaryTab['state']>) => void;
}

const GlossaryView: React.FC<GlossaryViewProps> = ({ tab, workspace, onUpdateState }) => {
    const { search } = tab.state;

    const terms = (Object.values(workspace.glossary.terms) as GlossaryTerm[]).sort((a, b) => 
        a.primaryName.localeCompare(b.primaryName)
    );

    const filtered = terms.filter(t => t.primaryName.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col h-full bg-deep-space text-foreground">
            {/* Header / Search */}
            <div className="p-4 border-b border-chrome-border bg-chrome-panel/50 backdrop-blur sticky top-0 z-10">
                <div className="flex items-center gap-2 mb-2 text-muted uppercase tracking-widest text-xs font-bold">
                    <Book size={14} className="text-accent"/> Universal Glossary
                </div>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input 
                        className="w-full bg-surface border border-chrome-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors text-foreground placeholder:text-muted"
                        placeholder="Filter terms..."
                        value={search}
                        onChange={(e) => onUpdateState({ search: e.target.value })}
                        autoFocus
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filtered.length === 0 ? (
                    <div className="text-center text-faint text-sm py-8 italic">
                        {terms.length === 0 ? "No terms in glossary." : "No matches found."}
                    </div>
                ) : (
                    filtered.map(term => {
                        const plainDef = noteContentToPlainText({ content: term.definitionRichText });
                        return (
                            <div key={term.termId} className="p-3 bg-surface/30 border border-chrome-border rounded hover:border-accent/50 transition-colors cursor-pointer group">
                                <div className="flex items-baseline justify-between">
                                    <span className="font-bold text-foreground group-hover:text-accent transition-colors">{term.primaryName}</span>
                                </div>
                                <div className="text-sm text-muted mt-1 leading-relaxed line-clamp-3">
                                    {plainDef || "No definition."}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            
            {/* Footer */}
            <div className="p-2 border-t border-chrome-border bg-chrome-panel/80 text-[10px] text-faint flex justify-between items-center">
                <span>Total Terms: {terms.length}</span>
                <span className="font-mono">STATE: PERSISTED</span>
            </div>
        </div>
    );
};

export default GlossaryView;