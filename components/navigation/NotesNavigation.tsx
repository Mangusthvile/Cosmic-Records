import React, { useState, useEffect, useRef } from 'react';
import { Workspace, Note, Folder, SearchFilters, NotesNavigationState } from '../../types';
import { FolderOpen, Search, Pin, Inbox, Layers, FilePlus, FolderPlus, RefreshCw, X, Filter, AlertTriangle, FileText, ChevronDown, ChevronRight, MoreVertical, Archive, Clock } from 'lucide-react';
import { createFolder, deleteFolder, moveNote, togglePin, renameFolder, permanentDeleteNote } from '../../services/storageService';
import { searchNotes, SearchResult } from '../../services/searchService';
import { vaultService } from '../../services/vaultService';
import { IconButton, Input, Separator } from '../ui/Primitives';
import AppIcon from '../AppIcon';
import MoveNoteModal from '../MoveNoteModal';
import ContextMenu, { ContextMenuItem } from '../ContextMenu';

interface NotesNavigationProps {
    workspace: Workspace;
    onOpenNote: (id: string) => void;
    onCreateNote: (folderId?: string) => void;
    onUpdateWorkspace: (ws: Workspace) => void;
    activeNoteId?: string | null;
    state: NotesNavigationState;
    onStateChange: (partial: Partial<NotesNavigationState>) => void;
}

const DEFAULT_FILTERS: SearchFilters = {
    folderId: 'all',
    includeSubfolders: true,
    universeTagId: 'all',
    type: 'all',
    status: 'all',
    unresolved: 'all'
};

const NotesNavigation: React.FC<NotesNavigationProps> = ({ 
    workspace, onOpenNote, onCreateNote, onUpdateWorkspace, activeNoteId, 
    state, onStateChange 
}) => {
    const { selectedSection, folderOpenState, searchState } = state;
    const { query: searchQuery, filters: searchFilters, isFiltersOpen: isSearchFiltersOpen } = searchState;

    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isResyncing, setIsResyncing] = useState(false);
    const [moveModalState, setMoveModalState] = useState<{ isOpen: boolean, noteId: string | null }>({ isOpen: false, noteId: null });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'note' | 'folder' | 'bg', targetId?: string } | null>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync Search
    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            const hasActiveFilters = 
                searchFilters.folderId !== 'all' ||
                searchFilters.type !== 'all' || searchFilters.status !== 'all' || 
                searchFilters.universeTagId !== 'all' || searchFilters.unresolved !== 'all';

            if (searchQuery || hasActiveFilters) {
                const results = searchNotes(workspace, searchQuery, searchFilters);
                setSearchResults(results);
            } else {
                setSearchResults([]);
            }
        }, 200);
        return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }, [searchQuery, searchFilters, workspace]);

    const isSearchMode = !!searchQuery || (searchFilters.folderId !== 'all' || searchFilters.type !== 'all' || searchFilters.status !== 'all' || searchFilters.universeTagId !== 'all' || searchFilters.unresolved !== 'all');

    // Actions
    const updateState = (partial: Partial<NotesNavigationState>) => onStateChange(partial);
    const updateSearch = (partial: Partial<typeof searchState>) => updateState({ searchState: { ...searchState, ...partial } });

    const handleClearSearch = () => updateSearch({ query: '', filters: DEFAULT_FILTERS });
    const handleResync = async () => { setIsResyncing(true); await vaultService.resyncVault('fast'); onUpdateWorkspace({...workspace}); setIsResyncing(false); };
    
    const toggleFolder = (folderId: string) => updateState({ folderOpenState: { ...folderOpenState, [folderId]: !folderOpenState[folderId] } });
    const setSelectedSection = (id: string | null) => updateState({ selectedSection: id });

    const handleContextMenu = (e: React.MouseEvent, type: 'note' | 'folder' | 'bg', targetId?: string) => {
        e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type, targetId });
    };

    // Helper Actions
    const handleDeleteFolder = (folderId: string) => { if (deleteFolder(workspace, folderId)) onUpdateWorkspace({ ...workspace }); else alert("Folder must be empty to delete."); };
    const handleRenameFolder = (folderId: string) => { const name = prompt("New folder name:"); if (name && renameFolder(workspace, folderId, name)) onUpdateWorkspace({ ...workspace }); };
    const handleMoveNote = (noteId: string, folderId: string) => { moveNote(workspace, noteId, folderId); onUpdateWorkspace({ ...workspace }); setMoveModalState({ isOpen: false, noteId: null }); };
    const handleTogglePin = (noteId: string) => { togglePin(workspace, noteId); onUpdateWorkspace({ ...workspace }); };
    const handleCreateFolder = () => { const name = prompt("New Folder Name:"); if (name) { createFolder(workspace, name); onUpdateWorkspace({...workspace}); }};
    const handlePermanentDelete = async (noteId: string) => {
        if (confirm("Permanently delete this note? This cannot be undone.")) {
            await permanentDeleteNote(workspace, noteId);
            onUpdateWorkspace({...workspace});
        }
    };
    const handleArchive = (noteId: string) => {
        const note = workspace.notes[noteId];
        if (note) {
            note.status = 'Archived';
            note.folderId = 'archived'; // Move to system folder if not already
            onUpdateWorkspace({...workspace});
            vaultService.onNoteChange(note);
        }
    };
    const handleRestore = (noteId: string) => {
        const note = workspace.notes[noteId];
        if (note) {
            note.status = 'Draft';
            note.folderId = 'inbox'; // Move back to inbox
            onUpdateWorkspace({...workspace});
            vaultService.onNoteChange(note);
        }
    };

    const getContextMenuItems = (): ContextMenuItem[] => {
        if (!contextMenu) return [];
        const { type, targetId } = contextMenu;
        if (type === 'bg') return [{ label: 'New Record', icon: FilePlus, onClick: () => onCreateNote('inbox') }, { label: 'New Folder', icon: FolderPlus, onClick: handleCreateFolder }];
        if (type === 'note' && targetId) {
            const note = workspace.notes[targetId];
            return [
                { label: 'Open', onClick: () => onOpenNote(targetId) },
                { label: 'Move to...', icon: FolderOpen, onClick: () => setMoveModalState({ isOpen: true, noteId: targetId }) },
                { label: 'Pin/Unpin', icon: Pin, onClick: () => handleTogglePin(targetId) },
                { separator: true },
                (note?.status as string) === 'Archived' 
                    ? { label: 'Restore', icon: RefreshCw, onClick: () => handleRestore(targetId) }
                    : { label: 'Archive', danger: true, icon: Archive, onClick: () => handleArchive(targetId) },
                note?.status === 'Archived' ? { label: 'Permanently Delete', danger: true, icon: AlertTriangle, onClick: () => handlePermanentDelete(targetId) } : undefined
            ].filter(Boolean) as ContextMenuItem[];
        }
        if (type === 'folder' && targetId) return [{ label: 'New Note', icon: FilePlus, onClick: () => onCreateNote(targetId) }, { label: 'Rename', onClick: () => handleRenameFolder(targetId) }, { label: 'Delete', danger: true, onClick: () => handleDeleteFolder(targetId) }];
        return [];
    };

    const getSortedItems = <T extends Note | Folder>(items: T[]): T[] => {
        return [...items].sort((a, b) => {
            const na = (a as any).title || (a as any).name;
            const nb = (b as any).title || (b as any).name;
            return na.localeCompare(nb);
        });
    };

    const filteredList = (() => {
        if (!selectedSection) return null;
        let notes: Note[] = [];
        const all = Object.values(workspace.notes) as Note[]; 
        switch(selectedSection) {
            case 'pinned': notes = all.filter((n) => n.pinned); break; 
            case 'inbox': notes = all.filter((n) => n.folderId === 'inbox' && n.status !== 'Archived'); break;
            case 'unresolved': notes = all.filter((n) => n.unresolved || n.folderId === 'unresolved'); break;
            case 'drafts': notes = all.filter((n) => n.status === 'Draft'); break;
            case 'recent': notes = [...all].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20); break;
            case 'archived': notes = all.filter((n) => n.status === 'Archived' || n.folderId === 'archived'); break;
        }
        return selectedSection === 'recent' ? notes : getSortedItems(notes);
    })();

    const renderFolder = (folder: Folder, depth: number) => {
        const isOpen = folderOpenState[folder.id];
        // Exclude system folders from main tree
        if (folder.id === 'inbox' || folder.id === 'unresolved' || folder.id === 'archived') return null;

        const childrenFolders = getSortedItems((Object.values(workspace.folders) as Folder[]).filter(f => f.parentId === folder.id));
        const childrenNotes = getSortedItems((Object.values(workspace.notes) as Note[]).filter(n => n.folderId === folder.id && n.status !== 'Archived'));
        const paddingLeft = (depth * 12) + 12;
  
        return (
            <div key={folder.id}>
                <div 
                    className={`flex items-center gap-1 py-1 pr-2 cursor-pointer text-xs select-none hover:bg-panel2 group`}
                    style={{ paddingLeft: `${paddingLeft}px` }}
                    onClick={() => toggleFolder(folder.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                >
                    <div className="text-text2 group-hover:text-text transition-colors">
                        {isOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    </div>
                    <FolderOpen size={14} className="text-accent/70 group-hover:text-accent" />
                    <span className="text-text2 group-hover:text-text truncate flex-1">{folder.name}</span>
                </div>
                {isOpen && (
                    <div>
                        {childrenFolders.map(child => renderFolder(child, depth + 1))}
                        {childrenNotes.map(note => (
                            <div 
                              key={note.id}
                              onClick={() => onOpenNote(note.id)}
                              onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                              className={`flex items-center gap-2 py-1 pr-2 cursor-pointer text-xs hover:bg-panel2 group ${activeNoteId === note.id ? 'bg-panel2 text-accent' : 'text-text2'}`}
                              style={{ paddingLeft: `${paddingLeft + 16}px` }}
                            >
                                 {note.unresolved ? <AlertTriangle size={12} className="text-danger flex-shrink-0" /> : <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${note.status === 'Canon' ? 'bg-success' : note.status === 'Experimental' ? 'bg-warning' : note.status === 'Draft' ? 'bg-text2' : 'bg-text2'}`}></span>}
                                 <span className={`truncate ${activeNoteId === note.id ? 'font-medium' : ''} ${note.unresolved ? 'text-danger italic' : ''}`}>{note.title || "Untitled"}</span>
                                 {note.pinned && <Pin size={10} className="text-accent ml-auto opacity-70" />}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-panel" onContextMenu={(e) => handleContextMenu(e, 'bg')}>
            {/* Header */}
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 border-b border-border bg-panel z-10">
                <div className="flex items-center gap-1">
                    <IconButton size="sm" onClick={() => onCreateNote('inbox')} title="New Note"><FilePlus size={16}/></IconButton>
                    <IconButton size="sm" onClick={handleCreateFolder} title="New Folder"><FolderPlus size={16}/></IconButton>
                    <IconButton size="sm" onClick={handleResync} title="Resync"><RefreshCw size={16} className={isResyncing ? "animate-spin text-accent" : ""} /></IconButton>
                </div>
            </div>

            {/* Search */}
            <div className="border-b border-border bg-panel flex flex-col p-2">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text2" />
                    <Input 
                        className="pl-8 pr-8"
                        placeholder="Search index..."
                        value={searchQuery}
                        onChange={(e) => updateSearch({ query: e.target.value })}
                    />
                    {isSearchMode ? (
                        <button onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-text2 hover:text-text"><X size={12} /></button>
                    ) : (
                        <button onClick={() => updateSearch({ isFiltersOpen: !isSearchFiltersOpen })} className={`absolute right-2 top-1/2 -translate-y-1/2 ${isSearchFiltersOpen ? 'text-accent' : 'text-text2 hover:text-text'}`}><Filter size={12} /></button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col p-2 space-y-4">
                {isSearchMode ? (
                    <div className="flex flex-col">
                        <div className="px-3 py-2 text-[10px] font-bold uppercase text-text2 tracking-widest flex justify-between"><span>Results ({searchResults.length})</span></div>
                        {searchResults.map(({ note }) => (
                            <div 
                                key={note.id}
                                onClick={() => onOpenNote(note.id)}
                                className={`px-3 py-2 border-b border-border cursor-pointer group transition-all ${activeNoteId === note.id ? 'bg-panel2 border-l-2 border-l-accent' : 'hover:bg-panel2'}`}
                            >
                                <div className="text-xs font-bold truncate text-text">{note.title}</div>
                                <div className="text-[9px] text-text2">{workspace.folders[note.folderId]?.name}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div>
                            {[
                                { id: 'pinned', label: 'Pinned', icon: Pin, count: (Object.values(workspace.notes) as Note[]).filter(n => n.pinned).length },
                                { id: 'recent', label: 'Recent', icon: Clock, count: null },
                                { id: 'inbox', label: 'Inbox', icon: Inbox, count: (Object.values(workspace.notes) as Note[]).filter(n => n.folderId === 'inbox' && n.status !== 'Archived').length },
                                { id: 'unresolved', label: 'Unresolved', icon: AlertTriangle, count: workspace.indexes.unresolved_note_ids.length },
                                { id: 'drafts', label: 'Drafts', icon: FileText, count: (Object.values(workspace.notes) as Note[]).filter(n => n.status === 'Draft').length },
                                { id: 'archived', label: 'Archived', icon: Archive, count: (Object.values(workspace.notes) as Note[]).filter(n => n.status === 'Archived' || n.folderId === 'archived').length },
                            ].map(s => (
                                <div 
                                    key={s.id}
                                    onClick={() => setSelectedSection(selectedSection === s.id ? null : s.id)}
                                    className={`flex items-center justify-between px-3 py-1.5 text-xs rounded-md cursor-pointer transition-colors mb-0.5 select-none ${selectedSection === s.id ? 'bg-accent/10 text-accent' : 'text-text2 hover:bg-panel2 hover:text-text'}`}
                                >
                                    <div className="flex items-center gap-2"><AppIcon icon={s.icon} size={14} /><span>{s.label}</span></div>
                                    {s.count !== null && <span className="text-[10px] opacity-50">{s.count}</span>}
                                </div>
                            ))}
                        </div>
                        <Separator className="my-2" />
                        {selectedSection ? (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <span className="text-[10px] font-bold uppercase text-accent tracking-wider">{selectedSection}</span>
                                    <button onClick={() => setSelectedSection(null)} className="text-[10px] text-text2 hover:text-text">Close</button>
                                </div>
                                {filteredList?.map(note => (
                                    <div 
                                        key={note.id}
                                        onClick={() => onOpenNote(note.id)}
                                        onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-all border-l-2 mb-0.5 ${activeNoteId === note.id ? 'bg-panel2 border-accent text-accent' : 'border-transparent hover:bg-panel2 hover:border-border text-text'}`}
                                    >
                                        <div className="flex items-center justify-between w-full min-w-0 gap-2">
                                            <span className={`text-xs font-medium truncate flex-1 ${note.unresolved ? 'text-danger italic' : ''}`}>{note.title}</span>
                                            {note.unresolved && <AlertTriangle size={10} className="text-danger flex-shrink-0" />}
                                            {note.pinned && <Pin size={10} className="text-accent flex-shrink-0 opacity-70" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div>
                                {(Object.values(workspace.folders) as Folder[]).filter(f => f.parentId === null && f.type === 'user').sort((a, b) => a.order - b.order).map(f => renderFolder(f, 0))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Move Modal Portal */}
            {moveModalState.isOpen && moveModalState.noteId && (
                <MoveNoteModal workspace={workspace} noteId={moveModalState.noteId} isOpen={true} onClose={() => setMoveModalState({isOpen: false, noteId: null})} onMove={(fid) => handleMoveNote(moveModalState.noteId!, fid)} />
            )}
            
            {/* Context Menu Portal */}
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={() => setContextMenu(null)} />}
        </div>
    );
};

export default NotesNavigation;