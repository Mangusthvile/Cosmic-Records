
import React, { useState, useEffect, useRef } from 'react';
import { Workspace, Note, Folder, SearchFilters, Tab, SidebarState, NavigationState, WidgetSystemState } from '../types';
import { Globe, Plus, Search, Star, FolderOpen, PanelRightClose, PanelLeftClose, PanelRightOpen, PanelLeftOpen, Settings, ChevronRight, ChevronDown, Pin, Inbox, Layers, FilePlus, FolderPlus, RefreshCw, X, Filter, AlertTriangle, FileText } from 'lucide-react';
import { createFolder, deleteFolder, moveNote, togglePin, renameFolder, createCollection, deleteCollection, addToCollection } from '../services/storageService';
import { searchNotes, SearchResult } from '../services/searchService';
import { vaultService } from '../services/vaultService';
import SettingsModal from './SettingsModal';
import MoveNoteModal from './MoveNoteModal';
import AppIcon from './AppIcon';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import WidgetBar from './WidgetBar'; 
import { Button, IconButton, Input, Separator, Badge } from './ui/Primitives';

// --- Types & Constants ---
interface LayoutProps {
  children: React.ReactNode;
  workspace: Workspace;
  onOpenNote: (id: string) => void;
  onOpenMap: () => void;
  onCreateNote: (folderId?: string) => void;
  onUpdateWorkspace: (workspace: Workspace) => void;
  activeNoteId?: string | null;
  activeTab?: Tab;
  initialSidebarState: SidebarState;
  initialNavState: NavigationState;
  onSidebarChange: (state: Partial<SidebarState>) => void;
  onNavChange: (state: Partial<NavigationState>) => void;
  initialWidgetState: any; 
  onWidgetChange: (state: any) => void;
}

const DEFAULT_FILTERS: SearchFilters = {
    folderId: 'all',
    collectionId: 'all',
    includeSubfolders: true,
    universeTagId: 'all',
    type: 'all',
    status: 'all',
    unresolved: 'all'
};

// --- Helper: Resizer Component ---
const Resizer: React.FC<{ 
    onMouseDown: (e: React.MouseEvent) => void, 
    side: 'left' | 'right' 
}> = ({ onMouseDown, side }) => (
    <div 
        className={`w-1 hover:w-1.5 h-full cursor-col-resize flex flex-col justify-center items-center group z-50 transition-all absolute top-0 bottom-0 bg-transparent hover:bg-accent2 active:bg-accent ${side === 'left' ? '-right-0.5' : '-left-0.5'}`}
        onMouseDown={onMouseDown}
    >
       <div className="h-8 w-0.5 bg-border group-hover:bg-accent/50 rounded-full transition-colors" />
    </div>
);

// --- Helper: Reopen Button ---
const ReopenTrigger: React.FC<{
    onClick: () => void,
    side: 'left' | 'right',
    icon: React.ElementType,
    badgeCount?: number
}> = ({ onClick, side, icon: Icon, badgeCount }) => (
    <button
        onClick={onClick}
        className={`absolute top-4 ${side === 'left' ? 'left-0 rounded-r-md border-l-0' : 'right-0 rounded-l-md border-r-0'} p-1.5 bg-panel border border-border text-text2 hover:text-accent hover:bg-panel2 shadow-soft z-40 transition-all group`}
    >
        <div className="relative">
            <Icon size={16} />
            {badgeCount && badgeCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-3 w-3 items-center justify-center rounded-full bg-danger text-[8px] text-white font-bold animate-pulse">
                    {badgeCount > 9 ? '9+' : badgeCount}
                </span>
            )}
        </div>
    </button>
);

const Layout: React.FC<LayoutProps> = ({ 
    children, workspace, onOpenNote, onOpenMap, onCreateNote, onUpdateWorkspace, activeNoteId, activeTab,
    initialSidebarState, initialNavState, onSidebarChange, onNavChange,
    initialWidgetState, onWidgetChange
}) => {
  const [navWidth, setNavWidth] = useState(initialSidebarState.navWidth);
  const [isNavCollapsed, setIsNavCollapsed] = useState(initialSidebarState.navCollapsed);
  const [widgetWidth, setWidgetWidth] = useState(initialSidebarState.widgetWidth);
  const [isWidgetCollapsed, setIsWidgetCollapsed] = useState(initialSidebarState.widgetCollapsed);
  
  const [folderOpenState, setFolderOpenState] = useState<Record<string, boolean>>(initialNavState.folderOpenState || {});
  const [selectedSection, setSelectedSection] = useState<string | null>(initialNavState.selectedSection);
  const [activeNavTab, setActiveNavTab] = useState<'files' | 'search' | 'map'>('files');
  
  const initialSearch = initialNavState.searchState || { query: '', filters: DEFAULT_FILTERS, isFiltersOpen: false };
  const [searchQuery, setSearchQuery] = useState(initialSearch.query);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(initialSearch.filters);
  const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(initialSearch.isFiltersOpen);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  const [isResyncing, setIsResyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [moveModalState, setMoveModalState] = useState<{ isOpen: boolean, noteId: string | null }>({ isOpen: false, noteId: null });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'note' | 'folder' | 'collection' | 'bg', targetId?: string } | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unresolvedCount = workspace.indexes.unresolved_note_ids.length;

  useEffect(() => { onSidebarChange({ navWidth }); }, [navWidth]);
  useEffect(() => { onSidebarChange({ navCollapsed: isNavCollapsed }); }, [isNavCollapsed]);
  useEffect(() => { onSidebarChange({ widgetWidth }); }, [widgetWidth]);
  useEffect(() => { onSidebarChange({ widgetCollapsed: isWidgetCollapsed }); }, [isWidgetCollapsed]);
  useEffect(() => { onNavChange({ folderOpenState }); }, [folderOpenState]);
  useEffect(() => { onNavChange({ selectedSection }); }, [selectedSection]);
  useEffect(() => {
      onNavChange({ searchState: { query: searchQuery, filters: searchFilters, isFiltersOpen: isSearchFiltersOpen } });
  }, [searchQuery, searchFilters, isSearchFiltersOpen]);

  useEffect(() => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
          const hasActiveFilters = 
              searchFilters.folderId !== 'all' || searchFilters.collectionId !== 'all' ||
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

  const isSearchMode = !!searchQuery || (searchFilters.folderId !== 'all' || searchFilters.collectionId !== 'all' || searchFilters.type !== 'all' || searchFilters.status !== 'all' || searchFilters.universeTagId !== 'all' || searchFilters.unresolved !== 'all');

  const handleClearSearch = () => { setSearchQuery(''); setSearchFilters(DEFAULT_FILTERS); };
  const handleResync = async () => { setIsResyncing(true); await vaultService.resyncVault('fast'); onUpdateWorkspace({...workspace}); setIsResyncing(false); };
  
  const toggleFolder = (folderId: string) => setFolderOpenState(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  const handleContextMenu = (e: React.MouseEvent, type: 'note' | 'folder' | 'collection' | 'bg', targetId?: string) => {
      e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, type, targetId });
  };
  const handleDeleteFolder = (folderId: string) => { if (deleteFolder(workspace, folderId)) onUpdateWorkspace({ ...workspace }); else alert("Folder must be empty to delete."); };
  const handleRenameFolder = (folderId: string) => { const name = prompt("New folder name:"); if (name && renameFolder(workspace, folderId, name)) onUpdateWorkspace({ ...workspace }); };
  const handleMoveNote = (noteId: string, folderId: string) => { moveNote(workspace, noteId, folderId); onUpdateWorkspace({ ...workspace }); setMoveModalState({ isOpen: false, noteId: null }); };
  const handleTogglePin = (noteId: string) => { togglePin(workspace, noteId); onUpdateWorkspace({ ...workspace }); };
  const handleCreateFolder = () => { const name = prompt("New Folder Name:"); if (name) { createFolder(workspace, name); onUpdateWorkspace({...workspace}); }};
  const handleCreateCollection = () => { const name = prompt("New Collection Name:"); if (name) { createCollection(workspace, name); onUpdateWorkspace({...workspace}); }};
  const handleDeleteCollection = (id: string) => { if (confirm("Delete this collection?")) { deleteCollection(workspace, id); onUpdateWorkspace({...workspace}); }};

  const getSortedItems = <T extends Note | Folder>(items: T[]): T[] => {
      return [...items].sort((a, b) => {
          const na = (a as any).title || (a as any).name;
          const nb = (b as any).title || (b as any).name;
          return na.localeCompare(nb);
      });
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
      if (!contextMenu) return [];
      const { type, targetId } = contextMenu;
      if (type === 'bg') return [{ label: 'New Record', icon: Plus, onClick: () => onCreateNote('inbox') }, { label: 'New Folder', icon: FolderOpen, onClick: handleCreateFolder }];
      if (type === 'note' && targetId) {
          const collections = Object.values(workspace.collections || {});
          return [
              { label: 'Open', onClick: () => onOpenNote(targetId) },
              { label: 'Move to...', icon: FolderOpen, onClick: () => setMoveModalState({ isOpen: true, noteId: targetId }) },
              { label: 'Pin/Unpin', icon: Pin, onClick: () => handleTogglePin(targetId) },
              ...(collections.length > 0 ? [{ separator: true } as any, ...collections.map(c => ({ label: `Add to ${c.name}`, onClick: () => { addToCollection(workspace, c.id, targetId); onUpdateWorkspace({...workspace}); } }))] : []),
              { separator: true },
              { label: 'Delete', danger: true, icon: AlertTriangle, onClick: () => { const n = workspace.notes[targetId]; n.status = 'Archived'; onUpdateWorkspace({...workspace}); }}
          ];
      }
      if (type === 'folder' && targetId) return [{ label: 'New Note', icon: Plus, onClick: () => onCreateNote(targetId) }, { label: 'Rename', onClick: () => handleRenameFolder(targetId) }, { label: 'Delete', danger: true, onClick: () => handleDeleteFolder(targetId) }];
      if (type === 'collection' && targetId) return [{ label: 'Delete Collection', danger: true, onClick: () => handleDeleteCollection(targetId) }];
      return [];
  };

  const filteredList = (() => {
      if (!selectedSection) return null;
      let notes: Note[] = [];
      const all = Object.values(workspace.notes) as Note[]; 
      if (selectedSection.startsWith('collection:')) {
          const colId = selectedSection.split(':')[1];
          const col = workspace.collections[colId];
          if (col) notes = col.noteIds.map(id => workspace.notes[id]).filter(Boolean);
      } else {
          switch(selectedSection) {
              case 'pinned': notes = all.filter((n) => n.pinned); break; 
              case 'inbox': notes = all.filter((n) => n.folderId === 'inbox'); break;
              case 'unresolved': notes = all.filter((n) => n.unresolved || n.folderId === 'unresolved'); break;
              case 'drafts': notes = all.filter((n) => n.status === 'Draft'); break;
          }
      }
      return getSortedItems(notes);
  })();

  const renderFolder = (folder: Folder, depth: number) => {
      const isOpen = folderOpenState[folder.id];
      const childrenFolders = getSortedItems((Object.values(workspace.folders) as Folder[]).filter(f => f.parentId === folder.id));
      const childrenNotes = getSortedItems((Object.values(workspace.notes) as Note[]).filter(n => n.folderId === folder.id && n.status !== 'Archived'));
      const paddingLeft = (depth * 12) + 12;

      return (
          <div key={folder.id}>
              <div 
                  className={`flex items-center gap-1 py-1 pr-2 cursor-pointer text-xs select-none hover:bg-panel2 group ${folder.id === 'inbox' || folder.id === 'unresolved' ? 'hidden' : ''}`}
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
                          </div>
                      ))}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="h-screen w-screen bg-bg text-text overflow-hidden font-sans flex" onContextMenu={(e) => handleContextMenu(e, 'bg')}>
        {moveModalState.isOpen && moveModalState.noteId && (
            <MoveNoteModal workspace={workspace} noteId={moveModalState.noteId} isOpen={true} onClose={() => setMoveModalState({isOpen: false, noteId: null})} onMove={(fid) => handleMoveNote(moveModalState.noteId!, fid)} />
        )}
        {isSettingsOpen && <SettingsModal workspace={workspace} onUpdateWorkspace={onUpdateWorkspace} onClose={() => setIsSettingsOpen(false)} />}
        {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={() => setContextMenu(null)} />}
        
        {/* FUNCTION BAR */}
        <aside className="w-[48px] bg-panel border-r border-border flex flex-col items-center py-4 gap-4 z-50 flex-shrink-0">
             <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center mb-4 shadow-glow">
                 <AppIcon icon={Star} size={16} className="text-white fill-white" />
             </div>
             <IconButton active={activeNavTab === 'files'} onClick={() => setActiveNavTab('files')}><FolderOpen size={20}/></IconButton>
             <IconButton active={activeNavTab === 'search'} onClick={() => setActiveNavTab('search')}><Search size={20}/></IconButton>
             <IconButton onClick={onOpenMap}><Globe size={20}/></IconButton>
             <div className="flex-1" />
             <IconButton onClick={() => setIsSettingsOpen(true)}><Settings size={20}/></IconButton>
        </aside>

        {/* NAVIGATION RAIL */}
        <aside 
            className="bg-panel border-r border-border flex flex-col overflow-hidden relative transition-all duration-300"
            style={{ width: isNavCollapsed ? 0 : navWidth, minWidth: isNavCollapsed ? 0 : undefined }}
        >
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 border-b border-border bg-panel z-10">
                 <div className="flex items-center gap-1">
                    <IconButton size="sm" onClick={() => onCreateNote('inbox')} title="New Note"><FilePlus size={16}/></IconButton>
                    <IconButton size="sm" onClick={handleCreateFolder} title="New Folder"><FolderPlus size={16}/></IconButton>
                    <IconButton size="sm" onClick={handleCreateCollection} title="New Collection"><Layers size={16}/></IconButton>
                    <IconButton size="sm" onClick={handleResync} title="Resync"><RefreshCw size={16} className={isResyncing ? "animate-spin text-accent" : ""} /></IconButton>
                 </div>
                 <IconButton size="sm" onClick={() => setIsNavCollapsed(true)}><PanelLeftClose size={14}/></IconButton>
            </div>
            
            <div className="border-b border-border bg-panel flex flex-col p-2">
                 <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text2" />
                    <Input 
                        className="pl-8 pr-8"
                        placeholder="Search index..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {isSearchMode ? (
                         <button onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-text2 hover:text-text"><X size={12} /></button>
                    ) : (
                        <button onClick={() => setIsSearchFiltersOpen(!isSearchFiltersOpen)} className={`absolute right-2 top-1/2 -translate-y-1/2 ${isSearchFiltersOpen ? 'text-accent' : 'text-text2 hover:text-text'}`}><Filter size={12} /></button>
                    )}
                 </div>
            </div>

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
                                { id: 'inbox', label: 'Inbox', icon: Inbox, count: (Object.values(workspace.notes) as Note[]).filter(n => n.folderId === 'inbox').length },
                                { id: 'unresolved', label: 'Unresolved', icon: AlertTriangle, count: workspace.indexes.unresolved_note_ids.length },
                                { id: 'drafts', label: 'Drafts', icon: FileText, count: (Object.values(workspace.notes) as Note[]).filter(n => n.status === 'Draft').length },
                            ].map(s => (
                                <div 
                                    key={s.id}
                                    onClick={() => setSelectedSection(selectedSection === s.id ? null : s.id)}
                                    className={`flex items-center justify-between px-3 py-1.5 text-xs rounded-md cursor-pointer transition-colors mb-0.5 select-none ${selectedSection === s.id ? 'bg-accent2 text-accent' : 'text-text2 hover:bg-panel2 hover:text-text'}`}
                                >
                                    <div className="flex items-center gap-2"><AppIcon icon={s.icon} size={14} /><span>{s.label}</span></div>
                                    <span className="text-[10px] opacity-50">{s.count}</span>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2">
                            <div className="px-3 py-1 text-[10px] font-bold uppercase text-text2 tracking-widest">Collections</div>
                            {Object.values(workspace.collections || {}).map(col => (
                                <div 
                                    key={col.id}
                                    onClick={() => setSelectedSection(selectedSection === `collection:${col.id}` ? null : `collection:${col.id}`)}
                                    onContextMenu={(e) => handleContextMenu(e, 'collection', col.id)}
                                    className={`flex items-center justify-between px-3 py-1.5 text-xs rounded-md cursor-pointer transition-colors mb-0.5 select-none ${selectedSection === `collection:${col.id}` ? 'bg-accent2 text-accent' : 'text-text2 hover:bg-panel2 hover:text-text'}`}
                                >
                                    <div className="flex items-center gap-2"><Layers size={14} /><span>{col.name}</span></div>
                                    <span className="text-[10px] opacity-50">{col.noteIds.length}</span>
                                </div>
                            ))}
                        </div>
                        <Separator className="my-2" />
                        {selectedSection ? (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <div className="flex items-center justify-between px-2 mb-2">
                                     <span className="text-[10px] font-bold uppercase text-accent tracking-wider">{selectedSection.startsWith('collection:') ? workspace.collections[selectedSection.split(':')[1]]?.name : selectedSection}</span>
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
            <Resizer onMouseDown={() => {}} side="right" />
        </aside>

        {/* WORKSPACE */}
        <div className="flex-1 flex flex-col min-w-0 bg-bg relative">
             {isNavCollapsed && <ReopenTrigger onClick={() => setIsNavCollapsed(false)} side="left" icon={PanelLeftOpen} badgeCount={unresolvedCount} />}
             <div className="flex-1 relative overflow-hidden">{children}</div>
             {isWidgetCollapsed && <ReopenTrigger onClick={() => setIsWidgetCollapsed(false)} side="right" icon={PanelRightOpen} />}
        </div>

        {/* WIDGET RAIL */}
        <aside 
            className="bg-panel border-l border-border flex flex-col overflow-hidden relative transition-all duration-300"
            style={{ width: isWidgetCollapsed ? 0 : widgetWidth, minWidth: isWidgetCollapsed ? 0 : undefined }}
        >
             <Resizer onMouseDown={() => {}} side="left" />
             <div className="h-10 flex-shrink-0 flex items-center justify-between px-4 border-b border-border bg-panel">
                 <span className="text-[0.7rem] font-bold tracking-widest text-text2 uppercase">Helper</span>
                 <IconButton size="sm" onClick={() => setIsWidgetCollapsed(true)}><PanelRightClose size={14}/></IconButton>
             </div>
             <div className="flex-1 overflow-hidden">
                 <WidgetBar workspace={workspace} activeNoteId={activeNoteId || null} activeTab={activeTab} onOpenNote={onOpenNote} onUpdateWorkspace={onUpdateWorkspace} initialState={initialWidgetState} onStateChange={onWidgetChange} />
             </div>
        </aside>
    </div>
  );
};

export default Layout;
