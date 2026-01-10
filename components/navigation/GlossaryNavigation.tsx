
import React, { useState, useMemo, useEffect } from 'react';
import { Workspace, GlossaryTerm, PendingTerm } from '../../types';
import { Plus, Search, Book, Check, X, Filter, ChevronDown, ChevronRight, Clock, Tag } from 'lucide-react';
import { IconButton, Input, Badge, Button, Separator } from '../ui/Primitives';
import { createBlankGlossaryTerm } from '../../services/storageService';

interface GlossaryNavigationProps {
    workspace: Workspace;
    onUpdateWorkspace: (ws: Workspace) => void;
    onOpenTerm: (termId: string) => void;
    onOpenPending: (pendingId: string) => void;
    state?: any;
    onStateChange?: (partial: any) => void;
}

const GlossaryNavigation: React.FC<GlossaryNavigationProps> = ({ 
    workspace, onUpdateWorkspace, onOpenTerm, onOpenPending,
    state, onStateChange 
}) => {
    // State persistence
    const searchQuery = state?.searchQuery || '';
    const selectedUniverses = state?.selectedUniverses || ([] as string[]);
    const isPendingCollapsed = state?.isPendingCollapsed ?? false;
    const isTermsCollapsed = state?.isTermsCollapsed ?? false;

    const updateState = (partial: any) => onStateChange && onStateChange(partial);

    // Derived Data
    // We rely on GlossaryIndex for performance, not full term objects
    const indexTerms = workspace.glossary.index.terms;
    const termIds = Object.keys(indexTerms);
    const pendingTerms = Object.values(workspace.glossary.pending) as PendingTerm[];
    const availableUniverses = workspace.settings.universeTags.tags;
    const occurrences = workspace.glossary.occurrences?.terms || {};

    // Search & Filter Logic
    const filteredTermIds = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return termIds.filter(id => {
            const t = indexTerms[id];
            
            // Search Filter
            const matchesSearch = !query || 
                t.primaryName.toLowerCase().includes(query) || 
                t.aliases.some(a => a.toLowerCase().includes(query));
            
            if (!matchesSearch) return false;

            // Universe Filter (Intersection)
            if (selectedUniverses.length > 0) {
                const hasScope = t.universeScopes.some(scope => selectedUniverses.includes(scope));
                // If term has no scopes, does it match "all"? Usually strict filter.
                // If term has scopes, at least one must match selected.
                if (!hasScope) return false;
            }

            return true;
        }).sort((a, b) => indexTerms[a].primaryName.localeCompare(indexTerms[b].primaryName));
    }, [searchQuery, selectedUniverses, indexTerms, termIds]);

    const filteredPending = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        return pendingTerms.filter(p => !query || p.proposedName.toLowerCase().includes(query));
    }, [searchQuery, pendingTerms]);

    // Handlers
    const handleCreateTerm = () => {
        const id = createBlankGlossaryTerm(workspace);
        onUpdateWorkspace({ ...workspace });
        onOpenTerm(id);
    };

    const toggleUniverseFilter = (tag: string) => {
        const current = selectedUniverses;
        const next = current.includes(tag) ? current.filter((t: string) => t !== tag) : [...current, tag];
        updateState({ selectedUniverses: next });
    };

    return (
        <div className="flex flex-col h-full bg-panel">
            {/* Header */}
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 border-b border-border bg-panel z-10">
                <div className="flex items-center gap-2">
                    <Book size={16} className="text-accent" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text">Glossary</span>
                </div>
                <div className="flex items-center gap-1">
                    <IconButton size="sm" onClick={handleCreateTerm} title="New Term"><Plus size={16}/></IconButton>
                </div>
            </div>

            {/* Controls */}
            <div className="border-b border-border bg-panel p-2 flex flex-col gap-2">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text2" />
                    <Input 
                        className="pl-8 pr-8"
                        placeholder="Search terms..."
                        value={searchQuery}
                        onChange={(e) => updateState({ searchQuery: e.target.value })}
                    />
                    {searchQuery && (
                        <button onClick={() => updateState({ searchQuery: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-text2 hover:text-text"><X size={12} /></button>
                    )}
                </div>
                
                {/* Universe Filters */}
                <div className="flex flex-wrap gap-1">
                    {availableUniverses.map(tag => (
                        <button
                            key={tag}
                            onClick={() => toggleUniverseFilter(tag)}
                            className={`px-2 py-0.5 text-[9px] rounded border transition-colors ${selectedUniverses.includes(tag) ? 'bg-accent/20 border-accent text-accent' : 'bg-panel2 border-transparent text-text2 hover:bg-surface'}`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                
                {/* Pending Section */}
                <div className="flex flex-col border-b border-border/50">
                    <button 
                        onClick={() => updateState({ isPendingCollapsed: !isPendingCollapsed })}
                        className="flex items-center justify-between px-3 py-2 bg-panel hover:bg-panel2 transition-colors select-none group"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={12} className={pendingTerms.length > 0 ? "text-warning" : "text-text2"} />
                            <span className="text-xs font-bold text-text2 group-hover:text-text">Pending</span>
                            {pendingTerms.length > 0 && <Badge variant="warning">{pendingTerms.length}</Badge>}
                        </div>
                        {isPendingCollapsed ? <ChevronRight size={12} className="text-text2" /> : <ChevronDown size={12} className="text-text2" />}
                    </button>
                    
                    {!isPendingCollapsed && (
                        <div className="bg-panel2/30 pb-2">
                            {filteredPending.length === 0 ? (
                                <div className="px-4 py-2 text-[10px] text-text2 italic opacity-50">No pending items.</div>
                            ) : (
                                filteredPending.map(p => (
                                    <div 
                                        key={p.pendingId}
                                        onClick={() => onOpenPending(p.pendingId)}
                                        className="px-3 py-1.5 cursor-pointer hover:bg-panel2 border-l-2 border-transparent hover:border-warning flex flex-col gap-0.5"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-text">{p.proposedName}</span>
                                            <span className="text-[9px] uppercase tracking-wide text-text2 opacity-70">{p.reason}</span>
                                        </div>
                                        {p.detectedInNoteIds.length > 0 && (
                                            <div className="text-[9px] text-text2 truncate opacity-50">
                                                from: {workspace.notes[p.detectedInNoteIds[0]]?.title || 'Unknown'}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Terms Section */}
                <div className="flex flex-col">
                    <button 
                        onClick={() => updateState({ isTermsCollapsed: !isTermsCollapsed })}
                        className="flex items-center justify-between px-3 py-2 bg-panel hover:bg-panel2 transition-colors select-none group"
                    >
                        <div className="flex items-center gap-2">
                            <Tag size={12} className="text-accent" />
                            <span className="text-xs font-bold text-text2 group-hover:text-text">All Terms</span>
                            <span className="text-[10px] text-text2 opacity-50">({filteredTermIds.length})</span>
                        </div>
                        {isTermsCollapsed ? <ChevronRight size={12} className="text-text2" /> : <ChevronDown size={12} className="text-text2" />}
                    </button>

                    {!isTermsCollapsed && (
                        <div>
                            {filteredTermIds.length === 0 ? (
                                <div className="px-4 py-4 text-center text-xs text-text2 italic">No terms match filters.</div>
                            ) : (
                                filteredTermIds.map(id => {
                                    const t = indexTerms[id];
                                    const occurrenceCount = occurrences[id]?.noteIds?.length || 0;
                                    
                                    return (
                                        <div 
                                            key={id}
                                            onClick={() => onOpenTerm(id)}
                                            className="px-3 py-1.5 cursor-pointer hover:bg-panel2 border-l-2 border-transparent hover:border-accent flex items-center justify-between group"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-text truncate group-hover:text-accent transition-colors">{t.primaryName}</div>
                                                <div className="flex gap-1 mt-0.5">
                                                    {t.universeScopes.map(scope => (
                                                        <span key={scope} className="text-[9px] text-text2 bg-surface px-1 rounded">{scope}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {occurrenceCount > 0 && (
                                                    <span className="text-[9px] text-text2 font-mono bg-surface border border-border px-1 rounded opacity-50 group-hover:opacity-100" title={`${occurrenceCount} mentions`}>
                                                        {occurrenceCount}
                                                    </span>
                                                )}
                                                {t.aliases.length > 0 && (
                                                    <span className="text-[9px] text-text2 bg-panel2 border border-border px-1 rounded opacity-50 group-hover:opacity-100" title={`${t.aliases.length} aliases`}>
                                                        +{t.aliases.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default GlossaryNavigation;
