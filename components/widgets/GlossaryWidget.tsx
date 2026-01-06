import React, { useState } from 'react';
import { Workspace, GlossaryTerm } from '../../types';
import { Search, Book, Plus } from 'lucide-react';
import { createGlossaryTerm } from '../../services/storageService';

interface GlossaryWidgetProps {
    workspace: Workspace;
    onUpdateWorkspace: (ws: Workspace) => void;
}

const GlossaryWidget: React.FC<GlossaryWidgetProps> = ({ workspace, onUpdateWorkspace }) => {
    const [search, setSearch] = useState('');
    const [definitionInput, setDefinitionInput] = useState('');
    const [termInput, setTermInput] = useState('');
    const [view, setView] = useState<'search' | 'define'>('search');

    const terms = (Object.values(workspace.glossary.terms) as GlossaryTerm[]);
    const filtered = terms.filter(t => t.term.toLowerCase().includes(search.toLowerCase()));

    const handleDefine = () => {
        if (!termInput || !definitionInput) return;
        createGlossaryTerm(workspace, termInput, definitionInput);
        onUpdateWorkspace({ ...workspace }); // Trigger save/render
        setTermInput('');
        setDefinitionInput('');
        setView('search');
        setSearch(termInput); // Show the new term
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Toggle Header */}
            <div className="flex border-b border-border text-[10px] font-bold uppercase tracking-widest">
                <button 
                    onClick={() => setView('search')}
                    className={`flex-1 py-2 hover:bg-surface transition-colors ${view === 'search' ? 'text-accent border-b-2 border-accent' : 'text-muted'}`}
                >
                    Search
                </button>
                <button 
                    onClick={() => setView('define')}
                    className={`flex-1 py-2 hover:bg-surface transition-colors ${view === 'define' ? 'text-accent border-b-2 border-accent' : 'text-muted'}`}
                >
                    Define
                </button>
            </div>

            {view === 'search' ? (
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="p-2 border-b border-border bg-surface/30">
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                            <input 
                                className="w-full bg-surface border border-border rounded pl-7 pr-2 py-1 text-xs focus:outline-none focus:border-accent"
                                placeholder="Search terms..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {filtered.length === 0 ? (
                            <div className="text-center text-xs text-muted italic mt-4">No matches.</div>
                        ) : (
                            filtered.map(term => (
                                <div key={term.id} className="p-2 border border-border rounded bg-surface/50 hover:bg-surface">
                                    <div className="text-xs font-bold text-foreground">{term.term}</div>
                                    <div className="text-[10px] text-muted mt-1 leading-snug line-clamp-3">{term.definition_plain}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-3 flex flex-col gap-3 h-full overflow-y-auto">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-muted font-bold uppercase">Term</label>
                        <input 
                            className="w-full bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent"
                            value={termInput}
                            onChange={(e) => setTermInput(e.target.value)}
                            placeholder="e.g. Warp Drive"
                        />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                         <label className="text-[10px] text-muted font-bold uppercase">Definition</label>
                         <textarea 
                            className="w-full h-full min-h-[100px] bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent resize-none"
                            value={definitionInput}
                            onChange={(e) => setDefinitionInput(e.target.value)}
                            placeholder="Describe the term..."
                        />
                    </div>
                    <button 
                        onClick={handleDefine}
                        disabled={!termInput || !definitionInput}
                        className="bg-accent text-white py-1.5 rounded text-xs font-bold shadow-glow hover:opacity-90 disabled:opacity-50"
                    >
                        Add to Glossary
                    </button>
                </div>
            )}
        </div>
    );
};

export default GlossaryWidget;