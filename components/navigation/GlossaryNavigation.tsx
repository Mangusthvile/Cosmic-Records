
import React, { useState } from 'react';
import { Workspace, GlossaryTerm, PendingTerm } from '../../types';
import { Plus, Search, Book, Check, X, Filter } from 'lucide-react';
import { IconButton, Input, Badge } from '../ui/Primitives';
import { glossaryService } from '../../services/glossaryService';

interface GlossaryNavigationProps {
    workspace: Workspace;
    onUpdateWorkspace: (ws: Workspace) => void;
    onOpenTerm: (termId: string) => void;
}

const GlossaryNavigation: React.FC<GlossaryNavigationProps> = ({ workspace, onUpdateWorkspace, onOpenTerm }) => {
    const [search, setSearch] = useState('');
    const [selectedUniverse, setSelectedUniverse] = useState<string | 'all'>('all');
    
    const terms = (Object.values(workspace.glossary.terms) as GlossaryTerm[]).sort((a, b) => a.term.localeCompare(b.term));
    const pending = workspace.glossary.pending || [];

    const filtered = terms.filter(t => {
        const matchesSearch = t.term.toLowerCase().includes(search.toLowerCase()) || t.aliases.some(a => a.toLowerCase().includes(search.toLowerCase()));
        const matchesUniverse = selectedUniverse === 'all' || t.universeTags.includes(selectedUniverse);
        return matchesSearch && matchesUniverse;
    });

    const handleCreateTerm = () => {
        const termText = prompt("New Term:");
        if (termText) {
            const term = glossaryService.createTerm(workspace, termText);
            onUpdateWorkspace({ ...workspace });
            onOpenTerm(term.id);
        }
    };

    const handleApprove = (p: PendingTerm) => {
        const term = glossaryService.approvePending(workspace, p.id);
        if (term) {
            onUpdateWorkspace({ ...workspace });
            onOpenTerm(term.id);
        }
    };

    const handleIgnore = (p: PendingTerm) => {
        glossaryService.ignorePending(workspace, p.id);
        onUpdateWorkspace({ ...workspace });
    };

    return (
        <div className="flex flex-col h-full bg-panel">
            {/* Header */}
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 border-b border-border bg-panel z-10">
                <div className="flex items-center gap-1">
                    <IconButton size="sm" onClick={handleCreateTerm} title="New Term"><Plus size={16}/></IconButton>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-text2">Glossary</div>
            </div>

            {/* Controls */}
            <div className="border-b border-border bg-panel p-2 space-y-2">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text2" />
                    <Input 
                        className="pl-8 text-xs"
                        placeholder="Filter terms..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {workspace.settings.universeTags.tags.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        <span className="text-[10px] text-text2 uppercase font-bold whitespace-nowrap"><Filter size={10} className="inline mr-1"/>Tag:</span>
                        <button 
                            onClick={() => setSelectedUniverse('all')}
                            className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${selectedUniverse === 'all' ? 'bg-accent/20 text-accent border-accent/30' : 'text-text2 border-border hover:bg-panel2'}`}
                        >
                            All
                        </button>
                        {workspace.settings.universeTags.tags.map(tag => (
                            <button 
                                key={tag}
                                onClick={() => setSelectedUniverse(tag)}
                                className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${selectedUniverse === tag ? 'bg-accent/20 text-accent border-accent/30' : 'text-text2 border-border hover:bg-panel2'}`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                
                {/* Pending Section */}
                {pending.length > 0 && (
                    <div className="space-y-1">
                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-warning tracking-widest flex items-center justify-between">
                            <span>Pending Review ({pending.length})</span>
                        </div>
                        {pending.map(p => (
                            <div key={p.id} className="p-2 bg-warning/5 border border-warning/20 rounded flex flex-col gap-1">
                                <div className="font-bold text-xs text-text">{p.term}</div>
                                {p.sourceNoteId && (
                                    <div className="text-[10px] text-text2 truncate">
                                        Detected in: <span className="text-accent">{workspace.notes[p.sourceNoteId]?.title || 'Unknown'}</span>
                                    </div>
                                )}
                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => handleApprove(p)} className="flex-1 flex items-center justify-center gap-1 bg-panel border border-border hover:bg-success/10 hover:border-success/30 hover:text-success py-1 rounded text-[10px] transition-colors">
                                        <Check size={10} /> Approve
                                    </button>
                                    <button onClick={() => handleIgnore(p)} className="flex-1 flex items-center justify-center gap-1 bg-panel border border-border hover:bg-panel2 hover:text-text2 py-1 rounded text-[10px] transition-colors">
                                        <X size={10} /> Ignore
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Term List */}
                <div className="space-y-0.5">
                    {filtered.length === 0 ? (
                        <div className="p-4 text-center text-xs text-text2 italic">No terms found.</div>
                    ) : (
                        filtered.map(term => (
                            <div 
                                key={term.id}
                                onClick={() => onOpenTerm(term.id)}
                                className="px-3 py-2 rounded cursor-pointer hover:bg-panel2 text-text transition-colors border border-transparent hover:border-border group"
                            >
                                <div className="flex items-center gap-2">
                                    <Book size={12} className="text-accent opacity-50 group-hover:opacity-100" />
                                    <span className="text-xs font-bold">{term.term}</span>
                                    {term.aliases.length > 0 && <span className="text-[9px] text-text2 bg-panel px-1 rounded opacity-50">+{term.aliases.length}</span>}
                                </div>
                                {term.universeTags.length > 0 && (
                                    <div className="flex gap-1 mt-1 pl-5">
                                        {term.universeTags.map(t => (
                                            <span key={t} className="text-[9px] px-1 rounded bg-panel border border-border text-text2">{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlossaryNavigation;
