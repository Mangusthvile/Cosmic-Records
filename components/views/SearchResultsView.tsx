
import React, { useMemo, useState } from 'react';
import { SearchResultsTab, Workspace, SearchFilters } from '../../types';
import { Search, Filter, AlertTriangle } from 'lucide-react';
import { searchNotes } from '../../services/searchService';
import { Button } from '../ui/Primitives';

interface SearchResultsViewProps {
    tab: SearchResultsTab;
    workspace: Workspace;
    onUpdateState: (partial: Partial<SearchResultsTab['state']>) => void;
    onOpenNote: (id: string) => void;
}

const SearchResultsView: React.FC<SearchResultsViewProps> = ({ tab, workspace, onUpdateState, onOpenNote }) => {
    const { query, filters } = tab.payload;
    const { scrollY } = tab.state;
    
    // Local state for refined query in this specific view, independent of global sidebar search
    const [localQuery, setLocalQuery] = useState(query);
    const [isDirty, setIsDirty] = useState(false);

    const results = useMemo(() => {
        return searchNotes(workspace, localQuery, filters);
    }, [localQuery, filters, workspace]);

    const handleQueryChange = (val: string) => {
        setLocalQuery(val);
        setIsDirty(true);
    };

    return (
        <div className="flex flex-col h-full bg-deep-space text-text">
            {/* Header */}
            <div className="p-4 border-b border-border bg-panel/50 backdrop-blur sticky top-0 z-10 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
                    <Search size={14} /> Search Results
                </div>
                <div className="relative">
                    <input 
                        className="w-full bg-panel2 border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                        value={localQuery}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        placeholder="Refine search..."
                    />
                </div>
                {/* Active Filters Summary */}
                <div className="flex flex-wrap gap-2 text-[10px] text-text2">
                    {filters.folderId !== 'all' && <span className="bg-panel2 px-1.5 py-0.5 rounded border border-border">Folder: {workspace.folders[filters.folderId]?.name || filters.folderId}</span>}
                    {filters.type !== 'all' && <span className="bg-panel2 px-1.5 py-0.5 rounded border border-border">Type: {filters.type}</span>}
                    {filters.status !== 'all' && <span className="bg-panel2 px-1.5 py-0.5 rounded border border-border">Status: {filters.status}</span>}
                    {filters.unresolved !== 'all' && <span className="bg-panel2 px-1.5 py-0.5 rounded border border-border text-danger">Unresolved: {filters.unresolved}</span>}
                </div>
            </div>

            {/* Results List */}
            <div 
                className="flex-1 overflow-y-auto p-4 space-y-2"
                onScroll={(e) => onUpdateState({ scrollY: (e.target as HTMLDivElement).scrollTop })}
            >
                {results.length === 0 ? (
                    <div className="text-center text-sm text-text2 italic py-8">No matching records found.</div>
                ) : (
                    results.map(({ note, score, snippet }) => (
                        <div 
                            key={note.id} 
                            onClick={() => onOpenNote(note.id)}
                            className="p-3 bg-panel2 border border-border rounded hover:border-accent/50 cursor-pointer group transition-all"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-text group-hover:text-accent truncate">{note.title}</span>
                                <span className="text-[10px] text-text2 uppercase">{note.type}</span>
                            </div>
                            <div className="text-xs text-text2 line-clamp-2 leading-relaxed">
                                {snippet}
                            </div>
                            <div className="mt-2 flex gap-2 text-[10px] text-text2 opacity-50">
                                <span>{workspace.folders[note.folderId]?.name}</span>
                                <span>•</span>
                                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <div className="p-2 border-t border-border bg-panel text-[10px] text-text2 flex justify-between">
                <span>{results.length} results</span>
            </div>
        </div>
    );
};

export default SearchResultsView;
