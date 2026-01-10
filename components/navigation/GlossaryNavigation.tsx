
import React, { useState } from 'react';
import { Workspace, GlossaryTerm } from '../../types';
import { Plus, Search, Book } from 'lucide-react';
import { IconButton, Input } from '../ui/Primitives';
import { createGlossaryTerm } from '../../services/storageService';

interface GlossaryNavigationProps {
    workspace: Workspace;
    onUpdateWorkspace: (ws: Workspace) => void;
    onOpenTerm: (termId: string) => void;
}

const GlossaryNavigation: React.FC<GlossaryNavigationProps> = ({ workspace, onUpdateWorkspace, onOpenTerm }) => {
    const [search, setSearch] = useState('');
    const terms = (Object.values(workspace.glossary.terms) as GlossaryTerm[]).sort((a, b) => a.term.localeCompare(b.term));
    const filtered = terms.filter(t => t.term.toLowerCase().includes(search.toLowerCase()));

    const handleCreateTerm = () => {
        const term = prompt("New Term:");
        if (term) {
            const definition = prompt("Definition:") || "";
            createGlossaryTerm(workspace, term, definition);
            onUpdateWorkspace({ ...workspace });
        }
    };

    return (
        <div className="flex flex-col h-full bg-panel">
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 border-b border-border bg-panel z-10">
                <div className="flex items-center gap-1">
                    <IconButton size="sm" onClick={handleCreateTerm} title="New Term"><Plus size={16}/></IconButton>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-text2">Glossary</div>
            </div>

            <div className="border-b border-border bg-panel p-2">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text2" />
                    <Input 
                        className="pl-8"
                        placeholder="Filter terms..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filtered.length === 0 ? (
                    <div className="p-4 text-center text-xs text-text2 italic">No terms found.</div>
                ) : (
                    filtered.map(term => (
                        <div 
                            key={term.id}
                            onClick={() => onOpenTerm(term.id)} // Currently just a placeholder action or opens search?
                            className="px-3 py-2 rounded cursor-pointer hover:bg-panel2 text-text transition-colors border-b border-border/50 group"
                        >
                            <div className="flex items-center gap-2">
                                <Book size={12} className="text-accent opacity-50 group-hover:opacity-100" />
                                <span className="text-xs font-bold">{term.term}</span>
                            </div>
                            <div className="text-[10px] text-text2 mt-1 line-clamp-2 pl-5 opacity-70">
                                {term.definition_plain}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default GlossaryNavigation;
