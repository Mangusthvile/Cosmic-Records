import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Workspace, Note, NoteType } from '../../types';
import { Search, Plus, X, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { Input, Button, Badge } from './Primitives';
import { createNote } from '../../services/storageService';

interface NoteReferencePickerProps {
    workspace: Workspace;
    allowedTypes: string[]; // e.g. ['Character'] or ['Place']
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    allowCreateNew?: boolean;
    createNewLabel?: string;
    onOpenNote: (id: string) => void;
    readOnly?: boolean;
    placeholder?: string;
    excludeSelfId?: string;
}

const NoteReferencePicker: React.FC<NoteReferencePickerProps> = ({ 
    workspace, allowedTypes, selectedId, onSelect, 
    allowCreateNew = false, createNewLabel = "Create New", onOpenNote,
    readOnly = false, placeholder = "Search...", excludeSelfId
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtered Results (Memoized for performance, no scanning)
    const filteredNotes = useMemo(() => {
        if (!isOpen) return [];
        const lowerQuery = query.toLowerCase().trim();
        return Object.values(workspace.notes)
            .filter((n: Note) => {
                if (excludeSelfId && n.id === excludeSelfId) return false;
                // Case-insensitive type check
                const matchType = allowedTypes.some(t => t.toLowerCase() === n.type.toLowerCase());
                if (!matchType) return false;
                if (!lowerQuery) return true;
                return n.title.toLowerCase().includes(lowerQuery);
            })
            .sort((a: Note, b: Note) => a.title.localeCompare(b.title))
            .slice(0, 10); // Limit results
    }, [workspace.notes, isOpen, query, allowedTypes, excludeSelfId]);

    const handleCreate = () => {
        const newNote = createNote(workspace, {
            title: query || "New Note",
            type: allowedTypes[0] || "General",
            folderId: 'inbox'
        });
        onSelect(newNote.id);
        setIsOpen(false);
        setQuery('');
    };

    const selectedNote = selectedId ? workspace.notes[selectedId] : null;

    if (readOnly) {
        if (!selectedId) return <span className="text-xs text-muted italic">None</span>;
        return (
            <div className="flex items-center gap-2">
                {selectedNote ? (
                    <button onClick={() => onOpenNote(selectedId)} className="flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                        {selectedNote.title} <ArrowRight size={12} />
                    </button>
                ) : (
                    <span className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12}/> Missing ({selectedId.slice(0, 6)}...)</span>
                )}
            </div>
        );
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            {selectedId ? (
                <div className="flex items-center gap-2 p-1.5 bg-panel2 border border-border rounded group">
                    {selectedNote ? (
                        <>
                            <div className="flex-1 min-w-0">
                                <button onClick={() => onOpenNote(selectedId)} className="text-xs font-bold text-accent hover:underline truncate w-full text-left">
                                    {selectedNote.title}
                                </button>
                                <div className="text-[9px] text-text2 flex gap-2">
                                    <span>{selectedNote.universeTag || 'Cosmos'}</span>
                                    <span>•</span>
                                    <span>{selectedNote.status}</span>
                                </div>
                            </div>
                            <button onClick={() => onSelect(null)} className="text-text2 hover:text-danger p-1"><X size={14} /></button>
                        </>
                    ) : (
                        <>
                            <span className="text-xs text-danger italic flex-1">Missing Reference</span>
                            <button onClick={() => onSelect(null)} className="text-text2 hover:text-danger p-1"><X size={14} /></button>
                        </>
                    )}
                </div>
            ) : (
                <div className="relative">
                    <Input 
                        placeholder={placeholder}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
                        onFocus={() => setIsOpen(true)}
                        className="text-xs"
                    />
                    <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-text2 pointer-events-none" />
                </div>
            )}

            {isOpen && !selectedId && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-panel border border-border rounded shadow-xl z-50 max-h-[200px] overflow-y-auto">
                    {filteredNotes.length > 0 ? (
                        filteredNotes.map(note => (
                            <button
                                key={note.id}
                                onClick={() => { onSelect(note.id); setIsOpen(false); setQuery(''); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-accent/10 hover:text-accent border-b border-border last:border-0 flex justify-between items-center"
                            >
                                <span className="font-bold truncate">{note.title}</span>
                                <span className="text-[9px] text-text2 opacity-50">{note.status}</span>
                            </button>
                        ))
                    ) : (
                        <div className="p-2 text-xs text-text2 italic text-center">No matches found.</div>
                    )}
                    
                    {allowCreateNew && query.trim() && !filteredNotes.some(n => n.title.toLowerCase() === query.trim().toLowerCase()) && (
                        <button 
                            onClick={handleCreate}
                            className="w-full text-left px-3 py-2 text-xs bg-panel2 hover:bg-surface border-t border-border flex items-center gap-2 text-accent font-bold"
                        >
                            <Plus size={12} /> {createNewLabel} "{query}"
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default NoteReferencePicker;