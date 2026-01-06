
import React, { useState, useEffect, useRef } from 'react';
import { Workspace, Note, Folder, SearchFilters, Tab, SidebarState, NavigationState, WidgetSystemState } from '../types';
import { Globe, Plus, Search, Star, FolderOpen, PanelRightClose, PanelLeftClose, PanelRightOpen, PanelLeftOpen, Settings, ChevronRight, ChevronDown, Pin, Inbox, Archive, Clock, FileText, X, Filter, FilePlus, FolderPlus, ArrowDownUp, ChevronsUp, Check, AlertTriangle } from 'lucide-react';
import { createFolder, deleteFolder, moveNote, togglePin, renameFolder } from '../services/storageService';
import { searchNotes, SearchResult } from '../services/searchService';
import SettingsModal from './SettingsModal';
import MoveNoteModal from './MoveNoteModal';
import AppIcon from './AppIcon';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import WidgetBar from './WidgetBar'; 

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
  
  // NEW: UI State Management Props
  initialSidebarState: SidebarState;
  initialNavState: NavigationState;
  onSidebarChange: (state: Partial<SidebarState>) => void;
  onNavChange: (state: Partial<NavigationState>) => void;
  
  // Widget State Props passed through
  initialWidgetState: any; 
  onWidgetChange: (state: any) => void;
}

type SortOption = 'name-asc' | 'name-desc' | 'modified-new' | 'modified-old' | 'created-new' | 'created-old';

const CONSTANTS = {
    NAV_MIN: 240,
    NAV_MAX: 480,
    NAV_DEFAULT: 300,
    WIDGET_MIN: 260,
    WIDGET_MAX: 520,
    WIDGET_DEFAULT: 340,
    FUNC_BAR_WIDTH: 48,
};

const DEFAULT_FILTERS: SearchFilters = {
    folderId: 'all',
    includeSubfolders: true,
    universeTagId: 'all',
    type: 'all',
    status: 'all'
};

// --- Helper: Resizer Component ---

const Resizer: React.FC<{ 
    onMouseDown: (e: React.MouseEvent) => void, 
    side: 'left' | 'right' 
}> = ({ onMouseDown, side }) => (
    <div 
        className={`w-1 hover:w-1.5 h-full cursor-col-resize flex flex-col justify-center items-center group z-50 transition-all absolute top-0 bottom-0 bg-transparent hover:bg-accent/50 active:bg-accent ${side === 'left' ? '-right-0.5' : '-left-0.5'}`}
        onMouseDown={onMouseDown}
    >
       <div className="h-8 w-0.5 bg-border group-hover:bg-white/50 rounded-full transition-colors" />
    </div>
);

// --- Helper: Reopen Button ---
const ReopenTrigger: React.FC<{
    onClick: () => void,
    side: 'left' | 'right',
    icon: React.ElementType
}> = ({ onClick, side, icon: Icon }) => (
    <button
        onClick={onClick}
        className={`absolute top-4 ${side === 'left' ? 'left-0 rounded-r-md border-l-0' : 'right-0 rounded-l-md border-r-0'} p-1.5 bg-surface border border-chrome-border text-muted hover:text-accent hover:bg-[var(--c-hover)] shadow-md z-40 transition-all`}
    >
        <Icon size={16} />
    </button>
);

// --- Main Component ---

const Layout: React.FC<LayoutProps> = ({ 
    children, workspace, onOpenNote, onOpenMap, onCreateNote, onUpdateWorkspace, activeNoteId, activeTab,
    initialSidebarState, initialNavState, onSidebarChange, onNavChange,
    initialWidgetState, onWidgetChange
}) => {
  // --- State: Layout (Hydrated from props) ---
  const [navWidth, setNavWidth] = useState(initialSidebarState.navWidth);
  const [isNavCollapsed, setIsNavCollapsed] = useState(initialSidebarState.navCollapsed);
  const [widgetWidth, setWidgetWidth] = useState(initialSidebarState.widgetWidth);
  const [isWidgetCollapsed, setIsWidgetCollapsed] = useState(initialSidebarState.widgetCollapsed);
  
  // --- State: Navigation (Hydrated from props) ---
  const [folderOpenState, setFolderOpenState] = useState<Record<string, boolean>>(initialNavState.folderOpenState || {});
  const [selectedSection, setSelectedSection] = useState<string | null>(initialNavState.selectedSection);

  // --- State: Content ---
  const [activeNavTab, setActiveNavTab] = useState<'files' | 'search' | 'map'>('files');
  
  // --- State: Search ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [isSearchFiltersOpen, setIsSearchFiltersOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // --- State: Sort ---
  const [sortOrder, setSortOrder] = useState<SortOption>('name-asc');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // --- State: Modals & Menus ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [moveModalState, setMoveModalState] = useState<{ isOpen: boolean, noteId: string | null }>({ isOpen: false, noteId: null });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'note' | 'folder' | 'bg', targetId?: string } | null>(null);

  // --- Refs ---
  const isDraggingRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // --- Change Reporters ---
  useEffect(() => { onSidebarChange({ navWidth }); }, [navWidth]);
  useEffect(() => { onSidebarChange({ navCollapsed: isNavCollapsed }); }, [isNavCollapsed]);
  useEffect(() => { onSidebarChange({ widgetWidth }); }, [widgetWidth]);
  useEffect(() => { onSidebarChange({ widgetCollapsed: isWidgetCollapsed }); }, [isWidgetCollapsed]);
  
  useEffect(() => { onNavChange({ folderOpenState }); }, [folderOpenState]);
  useEffect(() => { onNavChange({ selectedSection }); }, [selectedSection]);

  // --- Click Outside Sort Menu ---
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
              setIsSortMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Search Logic ---
  useEffect(() => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      
      searchTimeoutRef.current = setTimeout(() => {
          if (searchQuery || isSearchFiltersOpen) { // Only search if query exists or user is messing with filters
              const results = searchNotes(workspace, searchQuery, searchFilters);
              setSearchResults(results);
          } else {
              setSearchResults([]);
          }
      }, 200);

      return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, searchFilters, workspace]); 

  const isSearchMode = !!searchQuery || (isSearchFiltersOpen && (searchFilters.folderId !== 'all' || searchFilters.type !== 'all' || searchFilters.status !== 'all' || searchFilters.universeTagId !== 'all'));

  const handleClearSearch = () => {
      setSearchQuery('');
      setSearchFilters(DEFAULT_FILTERS);
      setIsSearchFiltersOpen(false);
  };

  // --- Logic ---
  
  useEffect(() => {
      const handleOpenNoteEvent = (e: Event) => {
          const customEvent = e as CustomEvent;
          const title = customEvent.detail?.title;
          if (title) {
              const id = workspace.indexes.title_to_note_id[title];
              if (id) onOpenNote(id);
          }
      };
      window.addEventListener('open-note', handleOpenNoteEvent);
      return () => window.removeEventListener('open-note', handleOpenNoteEvent);
  }, [workspace, onOpenNote]);


  const toggleFolder = (folderId: string) => {
      setFolderOpenState(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'note' | 'folder' | 'bg', targetId?: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, type, targetId });
  };

  const handleDeleteFolder = (folderId: string) => {
      const success = deleteFolder(workspace, folderId);
      if (success) onUpdateWorkspace({ ...workspace });
      else alert("Folder must be empty to delete.");
  };

  const handleRenameFolder = (folderId: string) => {
      const name = prompt("New folder name:");
      if (name) {
          if (renameFolder(workspace, folderId, name)) onUpdateWorkspace({ ...workspace });
          else alert("Rename failed. Name might be taken.");
      }
  };

  const handleMoveNote = (noteId: string, folderId: string) => {
      moveNote(workspace, noteId, folderId);
      onUpdateWorkspace({ ...workspace });
      setMoveModalState({ isOpen: false, noteId: null });
  };

  const handleTogglePin = (noteId: string) => {
      togglePin(workspace, noteId);
      onUpdateWorkspace({ ...workspace });
  };

  const handleCollapseAll = () => {
      setFolderOpenState({});
  };

  const handleCreateFolder = () => {
      const name = prompt("New Folder Name:");
      if (name) {
          createFolder(workspace, name);
          onUpdateWorkspace({...workspace});
      }
  };

  // --- Sorting Helper ---
  const getSortedItems = <T extends Note | Folder>(items: T[], type: 'note' | 'folder'): T[] => {
      return [...items].sort((a, b) => {
          // Name Sort
          if (sortOrder === 'name-asc') {
              const na = type === 'note' ? (a as unknown as Note).title : (a as unknown as Folder).name;
              const nb = type === 'note' ? (b as unknown as Note).title : (b as unknown as Folder).name;
              return na.localeCompare(nb);
          }
          if (sortOrder === 'name-desc') {
              const na = type === 'note' ? (a as unknown as Note).title : (a as unknown as Folder).name;
              const nb = type === 'note' ? (b as unknown as Note).title : (b as unknown as Folder).name;
              return nb.localeCompare(na);
          }

          // Time Sort
          const ta = (a as unknown as {updatedAt: number}).updatedAt;
          const tb = (b as unknown as {updatedAt: number}).updatedAt;
          const ca = (a as unknown as {createdAt: number}).createdAt;
          const cb = (b as unknown as {createdAt: number}).createdAt;

          if (sortOrder === 'modified-new') return tb - ta;
          if (sortOrder === 'modified-old') return ta - tb;
          if (sortOrder === 'created-new') return cb - ca;
          if (sortOrder === 'created-old') return ca - cb;

          return 0;
      });
  };

  // --- Renderers: System Sections ---

  const renderSystemSection = (id: string, label: string, icon: React.ElementType, filter: (n: Note) => boolean, count?: number) => {
      const isSelected = selectedSection === id;
      const notes = (Object.values(workspace.notes) as Note[]).filter(filter);
      const computedCount = count !== undefined ? count : notes.length;
      
      // Unresolved Warning Logic
      const isUnresolvedSection = id === 'unresolved';
      const hasUnresolved = workspace.indexes.unresolved_note_ids.length > 0;
      
      return (
          <div 
            onClick={() => { setSelectedSection(isSelected ? null : id); }}
            className={`flex items-center justify-between px-3 py-1.5 text-xs rounded-md cursor-pointer transition-colors mb-0.5 select-none
                ${isSelected ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-[var(--c-hover)] hover:text-foreground'}
            `}
          >
              <div className="flex items-center gap-2 relative">
                  <AppIcon icon={icon} size={14} className={isSelected ? "text-accent" : isUnresolvedSection && hasUnresolved ? "text-danger" : "text-muted"} />
                  <span className="font-medium">{label}</span>
                  {isUnresolvedSection && hasUnresolved && (
                      <span className="absolute -left-1 -top-0.5 w-1.5 h-1.5 bg-danger rounded-full animate-pulse shadow-glow"></span>
                  )}
              </div>
              <span className={`text-[10px] ${isUnresolvedSection && hasUnresolved ? 'text-danger font-bold' : 'opacity-50'}`}>{computedCount}</span>
          </div>
      );
  };

  // --- Renderers: Folder Tree ---

  const renderFolder = (folder: Folder, depth: number) => {
      const isOpen = folderOpenState[folder.id];
      const childrenFoldersRaw = (Object.values(workspace.folders) as Folder[])
        .filter(f => f.parentId === folder.id);
      const childrenFolders = getSortedItems<Folder>(childrenFoldersRaw, 'folder');
      
      const childrenNotesRaw = (Object.values(workspace.notes) as Note[])
        .filter(n => n.folderId === folder.id && (folder.id === 'archived' || n.status !== 'Archived'));
      const childrenNotes = getSortedItems<Note>(childrenNotesRaw, 'note');

      const paddingLeft = (depth * 12) + 12;

      return (
          <div key={folder.id}>
              {/* Folder Row */}
              <div 
                  className={`flex items-center gap-1 py-1 pr-2 cursor-pointer text-xs select-none hover:bg-[var(--c-hover)] group
                    ${folder.id === 'inbox' || folder.id === 'unresolved' ? 'hidden' : ''} 
                  `}
                  style={{ paddingLeft: `${paddingLeft}px` }}
                  onClick={() => toggleFolder(folder.id)}
                  onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
              >
                  <div className="text-muted group-hover:text-foreground transition-colors">
                      {isOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                  </div>
                  <FolderOpen size={14} className="text-accent/70 group-hover:text-accent" />
                  <span className="text-muted group-hover:text-foreground truncate flex-1">{folder.name}</span>
              </div>

              {/* Children */}
              {isOpen && (
                  <div>
                      {childrenFolders.map((child: Folder) => renderFolder(child, depth + 1))}
                      {childrenNotes.map((note: Note) => (
                          <div 
                            key={note.id}
                            onClick={() => onOpenNote(note.id)}
                            onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                            className={`flex items-center gap-2 py-1 pr-2 cursor-pointer text-xs hover:bg-[var(--c-hover)] group
                                ${activeNoteId === note.id ? 'bg-[var(--c-active)] text-accent' : 'text-muted'}
                            `}
                            style={{ paddingLeft: `${paddingLeft + 16}px` }}
                          >
                               <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                   note.status === 'Canon' ? 'bg-success' :
                                   note.status === 'Experimental' ? 'bg-warning' :
                                   note.status === 'Draft' ? 'bg-zinc-500' : 'bg-slate-600'
                               }`}></span>
                               <span className={`truncate ${activeNoteId === note.id ? 'font-medium' : ''}`}>{note.title || "Untitled"}</span>
                          </div>
                      ))}
                      {childrenFolders.length === 0 && childrenNotes.length === 0 && (
                          <div className="text-[10px] text-faint italic py-0.5" style={{ paddingLeft: `${paddingLeft + 16}px` }}>
                              Empty
                          </div>
                      )}
                  </div>
              )}
          </div>
      );
  };

  // --- Renderers: Search Results ---

  const renderSearchResults = () => {
      if (searchResults.length === 0) {
          return <div className="p-4 text-center text-xs text-muted italic">No records found.</div>;
      }

      return (
          <div className="flex flex-col">
              <div className="px-3 py-2 text-[10px] font-bold uppercase text-faint tracking-widest flex justify-between">
                  <span>Results ({searchResults.length})</span>
                  {searchFilters.status !== 'all' && <span className="text-accent">{searchFilters.status}</span>}
              </div>
              {searchResults.map(({ note, snippet, hasUnresolvedLinks }) => (
                  <div 
                    key={note.id}
                    onClick={() => onOpenNote(note.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                    className="px-3 py-2 border-b border-border hover:bg-[var(--c-hover)] cursor-pointer group"
                  >
                      <div className="flex items-center gap-2 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                               note.status === 'Canon' ? 'bg-success' :
                               note.status === 'Experimental' ? 'bg-warning' :
                               note.status === 'Draft' ? 'bg-zinc-500' : 'bg-slate-600'
                           }`}></span>
                          <span className="text-xs font-bold text-foreground truncate flex-1">{note.title}</span>
                          {note.unresolved && (
                              <span className="text-[9px] bg-danger/20 text-danger px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Unresolved</span>
                          )}
                      </div>
                      <div className="text-[10px] text-muted line-clamp-2 leading-relaxed">
                          {snippet}
                      </div>
                      {hasUnresolvedLinks && (
                          <div className="flex items-center gap-1 mt-1 text-[9px] text-warning font-medium">
                              <AlertTriangle size={8} /> Has Unresolved Links
                          </div>
                      )}
                  </div>
              ))}
          </div>
      );
  };

  // --- Context Menu Items ---
  const getContextMenuItems = (): ContextMenuItem[] => {
      if (!contextMenu) return [];
      const { type, targetId } = contextMenu;
      if (type === 'bg') return [{ label: 'New Record', icon: Plus, onClick: () => onCreateNote('inbox') }, { label: 'New Folder', icon: FolderOpen, onClick: () => { const name = prompt("Name"); if(name) createFolder(workspace, name); onUpdateWorkspace({...workspace}) }}];
      if (type === 'note' && targetId) return [
          { label: 'Open', onClick: () => onOpenNote(targetId) },
          { label: 'Move to...', icon: FolderOpen, onClick: () => setMoveModalState({ isOpen: true, noteId: targetId }) },
          { label: 'Pin/Unpin', icon: Pin, onClick: () => handleTogglePin(targetId) },
          { label: 'Delete', danger: true, icon: AlertTriangle, onClick: () => { const n = workspace.notes[targetId]; n.status = 'Archived'; onUpdateWorkspace({...workspace}); }}
      ];
      if (type === 'folder' && targetId) return [
          { label: 'New Note', icon: Plus, onClick: () => onCreateNote(targetId) },
          { label: 'New Sub-Folder', icon: FolderOpen, onClick: () => { const name = prompt("Name"); if(name) createFolder(workspace, name, targetId); onUpdateWorkspace({...workspace}); }},
          { label: 'Rename', onClick: () => handleRenameFolder(targetId) },
          { label: 'Delete', danger: true, onClick: () => handleDeleteFolder(targetId) }
      ];
      return [];
  };

  // --- Filtering ---
  const filteredList = (() => {
      if (!selectedSection) return null;
      let notes: Note[] = [];
      const all = Object.values(workspace.notes) as Note[];
      switch(selectedSection) {
          case 'pinned': notes = all.filter((n: Note) => n.pinned); break; // Use direct property
          case 'recent': notes = [...all].sort((a: Note, b: Note) => b.updatedAt - a.updatedAt).slice(0, 20); break;
          case 'inbox': notes = all.filter((n: Note) => n.folderId === 'inbox'); break;
          case 'unresolved': notes = all.filter((n: Note) => n.unresolved || n.folderId === 'unresolved'); break;
          case 'drafts': notes = all.filter((n: Note) => n.status === 'Draft'); break;
          case 'archived': notes = all.filter((n: Note) => n.status === 'Archived' || n.folderId === 'archived'); break;
      }
      return getSortedItems(notes, 'note');
  })();

  // --- Drag Handles ---
  const handleDragStart = (side: 'nav' | 'widget') => (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      document.body.style.cursor = 'col-resize';
      const startX = e.clientX;
      const startW = side === 'nav' ? navWidth : widgetWidth;
      const onMove = (ev: MouseEvent) => {
          if (!isDraggingRef.current) return;
          const delta = ev.clientX - startX;
          if (side === 'nav') setNavWidth(Math.min(Math.max(startW + delta, CONSTANTS.NAV_MIN), CONSTANTS.NAV_MAX));
          else setWidgetWidth(Math.min(Math.max(startW - delta, CONSTANTS.WIDGET_MIN), CONSTANTS.WIDGET_MAX));
      };
      const onUp = () => { isDraggingRef.current = false; document.body.style.cursor = ''; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
  };

  // --- Sort Menu Component ---
  const renderSortMenu = () => {
      const options: { id: SortOption, label: string }[] = [
          { id: 'name-asc', label: 'File name (A to Z)' },
          { id: 'name-desc', label: 'File name (Z to A)' },
          { id: 'modified-new', label: 'Modified time (new to old)' },
          { id: 'modified-old', label: 'Modified time (old to new)' },
          { id: 'created-new', label: 'Created time (new to old)' },
          { id: 'created-old', label: 'Created time (old to new)' },
      ];

      return (
          <div 
            ref={sortMenuRef}
            className="absolute top-full left-0 mt-1 min-w-[200px] bg-panel border border-border rounded-lg shadow-xl z-50 overflow-hidden"
          >
              <div className="py-1">
                  {options.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { setSortOrder(opt.id); setIsSortMenuOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[var(--c-hover)] text-foreground"
                      >
                          <span>{opt.label}</span>
                          {sortOrder === opt.id && <Check size={12} className="text-accent" />}
                      </button>
                  ))}
              </div>
          </div>
      );
  };

  const getPinnedCount = () => {
      // workspace.pinnedNoteIds might be stale if we moved to property-based.
      // Filter directly from notes as source of truth.
      return Object.values(workspace.notes).filter(n => n.pinned).length;
  };

  return (
    <div className="h-screen w-screen bg-chrome-bg text-chrome-text overflow-hidden font-sans flex" onContextMenu={(e) => handleContextMenu(e, 'bg')}>
        
        {/* Modals */}
        {moveModalState.isOpen && moveModalState.noteId && (
            <MoveNoteModal 
                workspace={workspace} 
                noteId={moveModalState.noteId} 
                isOpen={true} 
                onClose={() => setMoveModalState({isOpen: false, noteId: null})} 
                onMove={(fid) => handleMoveNote(moveModalState.noteId!, fid)}
            />
        )}
        {isSettingsOpen && (
            <SettingsModal 
                workspace={workspace} 
                onUpdateWorkspace={onUpdateWorkspace} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        )}
        {contextMenu && (
            <ContextMenu 
                x={contextMenu.x} 
                y={contextMenu.y} 
                items={getContextMenuItems()} 
                onClose={() => setContextMenu(null)} 
            />
        )}
        
        {/* FUNCTION BAR */}
        <aside className="w-[48px] bg-chrome-panel border-r border-chrome-border flex flex-col items-center py-4 gap-4 z-50 flex-shrink-0">
             <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-accent/20">
                 <AppIcon icon={Star} size={16} className="text-white fill-white" />
             </div>
             <button onClick={() => setActiveNavTab('files')} className={`p-2 rounded-lg transition-all ${activeNavTab === 'files' ? 'bg-surface text-accent' : 'text-muted hover:text-foreground'}`}><FolderOpen size={20}/></button>
             <button onClick={() => setActiveNavTab('search')} className={`p-2 rounded-lg transition-all ${activeNavTab === 'search' ? 'bg-surface text-accent' : 'text-muted hover:text-foreground'}`}><Search size={20}/></button>
             <button onClick={onOpenMap} className="p-2 text-muted hover:text-foreground"><Globe size={20}/></button>
             <div className="flex-1" />
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-muted hover:text-foreground"><Settings size={20}/></button>
        </aside>

        {/* NAVIGATION RAIL */}
        <aside 
            className="bg-chrome-panel border-r border-chrome-border flex flex-col overflow-hidden relative transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: isNavCollapsed ? 0 : navWidth, minWidth: isNavCollapsed ? 0 : undefined }}
        >
            {/* TOOLBAR HEADER */}
            <div className="h-10 flex-shrink-0 flex items-center justify-between px-2 border-b border-chrome-border bg-chrome-panel z-10">
                 <div className="flex items-center gap-1">
                    <button className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded transition-colors" title="New Note" onClick={() => onCreateNote('inbox')}>
                        <FilePlus size={16}/>
                    </button>
                    <button className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded transition-colors" title="New Folder" onClick={handleCreateFolder}>
                        <FolderPlus size={16}/>
                    </button>
                    <div className="relative">
                         <button 
                            className={`p-1.5 rounded transition-colors ${isSortMenuOpen ? 'bg-surface text-accent' : 'text-muted hover:text-foreground hover:bg-surface'}`} 
                            title="Change Sort Order" 
                            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                        >
                            <ArrowDownUp size={16}/>
                        </button>
                         {isSortMenuOpen && renderSortMenu()}
                    </div>
                    <button className="p-1.5 text-muted hover:text-foreground hover:bg-surface rounded transition-colors" title="Collapse All" onClick={handleCollapseAll}>
                        <ChevronsUp size={16}/>
                    </button>
                 </div>
                 <button onClick={() => setIsNavCollapsed(true)} className="text-muted hover:text-foreground"><PanelLeftClose size={14}/></button>
            </div>
            
            {/* SEARCH AREA */}
            <div className="px-3 py-3 border-b border-chrome-border bg-chrome-panel">
                 <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input 
                        className="w-full bg-surface border border-chrome-border rounded-md pl-8 pr-8 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent transition-colors placeholder:text-muted"
                        placeholder="Search vault..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => { if(!searchQuery && !isSearchMode) setSearchQuery(''); }}
                    />
                    {isSearchMode ? (
                         <button 
                            onClick={handleClearSearch}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                         >
                            <X size={12} />
                         </button>
                    ) : (
                        <button 
                            onClick={() => setIsSearchFiltersOpen(!isSearchFiltersOpen)}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 ${isSearchFiltersOpen ? 'text-accent' : 'text-muted hover:text-foreground'}`}
                        >
                            <Filter size={12} />
                        </button>
                    )}
                 </div>
                 
                 {/* FILTERS PANEL */}
                 {isSearchFiltersOpen && (
                     <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                         {/* Folder Filter */}
                         <div className="flex flex-col gap-1">
                             <label className="text-[10px] text-muted font-bold uppercase">Folder</label>
                             <select 
                                className="bg-surface border border-border rounded px-2 py-1 text-[10px] text-foreground focus:outline-none"
                                value={searchFilters.folderId}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchFilters(prev => ({ ...prev, folderId: e.target.value }))}
                             >
                                 <option value="all">All Folders</option>
                                 {(Object.values(workspace.folders) as Folder[])
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))
                                 }
                             </select>
                         </div>
                         
                         {/* Other Filters Row */}
                         <div className="grid grid-cols-2 gap-2">
                             <div className="flex flex-col gap-1">
                                 <label className="text-[10px] text-muted font-bold uppercase">Type</label>
                                 <select 
                                    className="bg-surface border border-border rounded px-2 py-1 text-[10px] text-foreground focus:outline-none"
                                    value={searchFilters.type}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchFilters(prev => ({ ...prev, type: e.target.value }))}
                                 >
                                     <option value="all">All Types</option>
                                     <option value="General">General</option>
                                     <option value="Character">Character</option>
                                     <option value="Place">Place</option>
                                     <option value="Item">Item</option>
                                     <option value="Event">Event</option>
                                     <option value="Lore">Lore</option>
                                 </select>
                             </div>
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] text-muted font-bold uppercase">Status</label>
                                 <select 
                                    className="bg-surface border border-border rounded px-2 py-1 text-[10px] text-foreground focus:outline-none"
                                    value={searchFilters.status}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchFilters(prev => ({ ...prev, status: e.target.value }))}
                                 >
                                     <option value="all">All Status</option>
                                     <option value="Draft">Draft</option>
                                     <option value="Canon">Canon</option>
                                     <option value="Experimental">Experimental</option>
                                     <option value="Outdated">Outdated</option>
                                     <option value="Archived">Archived</option>
                                 </select>
                             </div>
                         </div>
                     </div>
                 )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col p-2 space-y-4">
                
                {isSearchMode ? (
                    // --- SEARCH RESULTS MODE ---
                    renderSearchResults()
                ) : (
                    // --- TREE MODE ---
                    <>
                        {/* SYSTEM SECTIONS */}
                        <div>
                            {renderSystemSection('pinned', 'Pinned', Pin, (n: Note) => n.pinned, getPinnedCount())}
                            {renderSystemSection('recent', 'Recent', Clock, () => false, undefined)}
                            {renderSystemSection('inbox', 'Inbox', Inbox, (n: Note) => n.folderId === 'inbox')}
                            {renderSystemSection('unresolved', 'Unresolved', AlertTriangle, (n: Note) => n.unresolved || n.folderId === 'unresolved')}
                            {renderSystemSection('drafts', 'Drafts', FileText, (n: Note) => n.status === 'Draft')}
                            {renderSystemSection('archived', 'Archived', Archive, (n: Note) => n.status === 'Archived' || n.folderId === 'archived')}
                        </div>
                        <div className="h-[1px] bg-border mx-2"></div>
                        {/* LIST / TREE */}
                        {selectedSection ? (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <div className="flex items-center justify-between px-2 mb-2">
                                     <span className="text-[10px] font-bold uppercase text-accent tracking-wider">{selectedSection}</span>
                                     <button onClick={() => setSelectedSection(null)} className="text-[10px] text-muted hover:text-foreground">Close</button>
                                </div>
                                {filteredList?.map(note => (
                                     <div 
                                        key={note.id}
                                        onClick={() => onOpenNote(note.id)}
                                        onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-all border-l-2 mb-0.5
                                            ${activeNoteId === note.id ? 'bg-[var(--c-active)] border-accent' : 'border-transparent hover:bg-[var(--c-hover)] hover:border-chrome-border'}
                                        `}
                                    >
                                        <span className="text-xs font-medium truncate flex-1 text-foreground">{note.title}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div>
                                 {(Object.values(workspace.folders) as Folder[])
                                    .filter((f: Folder) => f.parentId === null && f.type === 'user') 
                                    .sort((a, b) => a.order - b.order) // Initial arbitrary sort for roots, real sort inside
                                    .map(f => renderFolder(f, 0))
                                 }
                                 {/* Only show prompt if empty so they can get started, else the toolbar buttons are primary */}
                                 {Object.values(workspace.folders).filter(f => f.type === 'user').length === 0 && (
                                     <div className="text-center py-4">
                                         <p className="text-[10px] text-muted mb-2">No folders yet.</p>
                                         <button onClick={handleCreateFolder} className="text-xs text-accent hover:underline">Create Folder</button>
                                     </div>
                                 )}
                            </div>
                        )}
                    </>
                )}
            </div>
            <Resizer onMouseDown={handleDragStart('nav')} side="right" />
        </aside>

        {/* WORKSPACE */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
             {isNavCollapsed && <ReopenTrigger onClick={() => setIsNavCollapsed(false)} side="left" icon={PanelLeftOpen} />}
             <div className="flex-1 relative overflow-hidden">{children}</div>
             {isWidgetCollapsed && <ReopenTrigger onClick={() => setIsWidgetCollapsed(false)} side="right" icon={PanelRightOpen} />}
        </div>

        {/* WIDGET RAIL - REFACTORED TO USE WIDGETBAR */}
        <aside 
            className="bg-chrome-panel border-l border-chrome-border flex flex-col overflow-hidden relative transition-all duration-300"
            style={{ width: isWidgetCollapsed ? 0 : widgetWidth, minWidth: isWidgetCollapsed ? 0 : undefined }}
        >
             <Resizer onMouseDown={handleDragStart('widget')} side="left" />
             <div className="h-10 flex-shrink-0 flex items-center justify-between px-4 border-b border-chrome-border bg-chrome-panel">
                 <span className="text-[0.75rem] font-bold tracking-widest text-muted uppercase">Helper</span>
                 <button onClick={() => setIsWidgetCollapsed(true)} className="text-muted hover:text-foreground"><PanelRightClose size={14}/></button>
             </div>
             
             {/* New Widget Bar System */}
             <div className="flex-1 overflow-hidden">
                 <WidgetBar 
                    workspace={workspace}
                    activeNoteId={activeNoteId || null}
                    activeTab={activeTab}
                    onOpenNote={onOpenNote}
                    onUpdateWorkspace={onUpdateWorkspace}
                    initialState={initialWidgetState}
                    onStateChange={onWidgetChange}
                 />
             </div>
        </aside>

    </div>
  );
};

export default Layout;
