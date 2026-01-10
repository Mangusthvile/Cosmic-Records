
import React, { useState, useEffect } from 'react';
import { Note, Workspace, PaneState, PaneId, UIState, MissingTab, NoteTab, SidebarState, NavigationState, WidgetSystemState, SearchFilters } from './types';
import { createNote, updateNote, logNotification, createMap, createGlossaryTerm, scanNoteForPending } from './services/storageService'; 
import { vaultService } from './services/vaultService';
import { generateTitle } from './services/geminiService';
import AppShell from './components/Layout'; 
import { usePaneSystem } from './hooks/usePaneSystem';
import { useHotkeys } from './hooks/useHotkeys'; 
import { PaneGrid } from './components/PaneSystem';
import NoteCreationModal from './components/NoteCreationModal';
import VaultPicker from './components/VaultPicker';
import SettingsModal from './components/SettingsModal';
import DevInvariantChecker from './components/DevInvariantChecker';

// Navigation Components
import NotesNavigation from './components/navigation/NotesNavigation';
import StarMapNavigation from './components/navigation/StarMapNavigation';
import GlossaryNavigation from './components/navigation/GlossaryNavigation';
import WidgetBar from './components/WidgetBar';

type VaultState = 'initializing' | 'no-vault' | 'active';

const DEFAULT_SIDEBAR_STATE: SidebarState = { navWidth: 300, navCollapsed: false, widgetWidth: 340, widgetCollapsed: false };

const DEFAULT_SEARCH_FILTERS: SearchFilters = {
    folderId: 'all',
    includeSubfolders: true,
    universeTagId: 'all',
    type: 'all',
    status: 'all',
    unresolved: 'all'
};

const DEFAULT_NAV_STATE: NavigationState = { 
    activeMode: 'notes',
    notes: {
        selectedSection: null, 
        folderOpenState: {},
        searchState: {
            query: '',
            filters: DEFAULT_SEARCH_FILTERS,
            isFiltersOpen: false
        }
    },
    glossary: {
        searchQuery: '',
        selectedUniverses: [],
        isPendingCollapsed: false,
        isTermsCollapsed: false
    }
};

const DEFAULT_WIDGET_STATE: WidgetSystemState = { openWidgetIds: ['outline', 'backlinks'], widgetStates: {} };

const App: React.FC = () => {
  const [vaultState, setVaultState] = useState<VaultState>('initializing');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  
  // -- UI State --
  const [sidebarState, setSidebarState] = useState<SidebarState>(DEFAULT_SIDEBAR_STATE);
  const [navState, setNavState] = useState<NavigationState>(DEFAULT_NAV_STATE);
  const [widgetState, setWidgetState] = useState<WidgetSystemState>(DEFAULT_WIDGET_STATE);
  
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [creationTargetFolderId, setCreationTargetFolderId] = useState<string>('inbox');
  
  // -- Hooks --
  const paneSystem = usePaneSystem();

  // --- Derived State ---
  const activeMode = navState.activeMode;
  const focusedPane = paneSystem.state.panes[paneSystem.state.focusedPaneId];
  const activeTab = focusedPane?.tabs.find(t => t.id === focusedPane.activeTabId);
  const activeNoteId = activeTab?.kind === 'note' ? (activeTab as NoteTab).payload.noteId : null;

  // --- Theme Sync ---
  useEffect(() => {
      if (workspace && workspace.settings.ui.accentColor) {
          document.documentElement.style.setProperty('--accent', workspace.settings.ui.accentColor);
          // Simplified RGBA for glow, just rely on opacity CSS if needed or update logic
      }
  }, [workspace?.settings.ui.accentColor]);

  // --- Handlers ---
  const handleCreateNoteTrigger = (folderId: string = 'inbox') => {
      setCreationTargetFolderId(folderId);
      setIsCreationModalOpen(true);
  };

  const handleManualSave = () => {
      window.dispatchEvent(new CustomEvent('app-command', { detail: { command: 'note.save' } }));
  };

  const handleFind = () => {
      window.dispatchEvent(new CustomEvent('app-command', { detail: { command: 'editor.find' } }));
  };

  const handleUpdateNote = (updatedNote: Note, updatedWorkspace?: Workspace) => {
    setWorkspace(prev => {
        if (!prev) return null;
        let nextWorkspace = updatedWorkspace ? { ...updatedWorkspace } : { ...prev };
        nextWorkspace = updateNote(nextWorkspace, updatedNote);
        scanNoteForPending(nextWorkspace, updatedNote);
        vaultService.onNoteChange(updatedNote);
        return nextWorkspace;
    });
  };

  const handleUpdateWorkspace = (newWorkspace: Workspace) => {
      setWorkspace(newWorkspace);
  };

  const handleGenerateTitle = async (note: Note) => {
    const newTitle = await generateTitle(note.content);
    handleUpdateNote({ ...note, title: newTitle });
  };

  const handleOpenNote = (id: string) => {
      if (!workspace) return;
      const note = workspace.notes[id];
      // M6: Check if Character view is needed
      if (note && note.metadata?.characterData) {
          // Open Character Tab
          paneSystem.openTabInPane(paneSystem.state.focusedPaneId, {
              id: crypto.randomUUID(),
              kind: 'character',
              title: note.title,
              version: 1,
              payload: { noteId: id },
              state: { scrollY: 0 }
          });
          return;
      }

      if (note) {
          paneSystem.openNoteTab(id, note.title);
      } else {
          paneSystem.openNoteTab(id, "Unresolved Link");
      }
  };

  const handleOpenTerm = (termId: string) => {
      if (!workspace) return;
      const term = workspace.glossary.terms[termId];
      if (term) {
          paneSystem.openTabInPane(paneSystem.state.focusedPaneId, {
              id: termId,
              kind: 'glossary_term',
              title: term.primaryName,
              version: 1,
              payload: { termId },
              state: { scrollY: 0 }
          });
      }
  };

  const handleOpenPending = (pendingId: string) => {
      window.dispatchEvent(new CustomEvent('open-widget-pending', { detail: { pendingId } }));
  };

  const handleOpenMap = (mapId?: string) => {
      paneSystem.openStarMapTab();
  };

  useHotkeys(workspace as Workspace, paneSystem, navState, (partial) => setNavState(prev => ({...prev, ...partial})), widgetState, setWidgetState, { saveNote: handleManualSave, findInNote: handleFind, newNote: () => { if (activeMode === 'notes') handleCreateNoteTrigger(); } });

  useEffect(() => {
      const init = async () => {
          const status = await vaultService.initialize();
          if (status === 'active') {
              try {
                  const ws = await vaultService.loadWorkspace();
                  const uiState = await vaultService.loadUIState();
                  if (uiState) {
                      if (uiState.paneSystem && uiState.paneSystem.panes) paneSystem.restoreState(uiState.paneSystem);
                      setSidebarState(uiState.layout || DEFAULT_SIDEBAR_STATE);
                      setNavState({ ...DEFAULT_NAV_STATE, ...(uiState.navigation || {}) });
                      setWidgetState(uiState.widgets || DEFAULT_WIDGET_STATE);
                  } else {
                      const notes = (Object.values(ws.notes) as Note[]).sort((a, b) => b.updatedAt - a.updatedAt);
                      if (notes.length > 0) paneSystem.openNoteTab(notes[0].id, notes[0].title);
                      else paneSystem.openStarMapTab();
                  }
                  setWorkspace(ws);
                  setVaultState('active');
              } catch (e) { console.error("Failed load", e); setVaultState('no-vault'); }
          } else { setVaultState('no-vault'); }
      };
      init();
  }, []);

  useEffect(() => {
      if (vaultState === 'active' && workspace) {
          const currentUIState: UIState = { schemaVersion: 1, savedAt: Date.now(), paneSystem: paneSystem.state, layout: sidebarState, navigation: navState, widgets: widgetState };
          vaultService.debouncedSaveUIState(currentUIState);
      }
  }, [paneSystem.state, sidebarState, navState, widgetState, vaultState, workspace]);

  // Sync tab titles
  useEffect(() => {
      if (!workspace) return;
      (Object.entries(paneSystem.state.panes) as [PaneId, PaneState][]).forEach(([paneId, pane]) => {
          pane.tabs.forEach(tab => {
              if (tab.kind === 'note') {
                  const note = workspace.notes[(tab as NoteTab).payload.noteId];
                  if (note && tab.title !== note.title) paneSystem.updateTab(paneId, tab.id, { title: note.title });
              }
              if (tab.kind === 'glossary_term') {
                  const term = workspace.glossary.terms[(tab as any).payload.termId];
                  if (term && tab.title !== term.primaryName) paneSystem.updateTab(paneId, tab.id, { title: term.primaryName });
              }
          });
      });
  }, [workspace]);

  const handleVaultReady = async () => {
      const ws = await vaultService.loadWorkspace();
      setWorkspace(ws);
      setVaultState('active');
      paneSystem.openStarMapTab(); 
  };

  useEffect(() => { if (workspace && vaultState === 'active') vaultService.onWorkspaceChange(workspace); }, [workspace, vaultState]);

  useEffect(() => {
      const handleLayoutCommands = (e: CustomEvent) => {
          if (e.detail.command === 'toggle-nav-bar') setSidebarState(prev => ({ ...prev, navCollapsed: !prev.navCollapsed }));
          if (e.detail.command === 'toggle-widget-bar') setSidebarState(prev => ({ ...prev, widgetCollapsed: !prev.widgetCollapsed }));
      };
      window.addEventListener('app-command', handleLayoutCommands as any);
      return () => window.removeEventListener('app-command', handleLayoutCommands as any);
  }, []);

  const handleCreateNoteConfirm = (options: any) => {
      if (!workspace) return;
      
      let newNote: Note;
      
      // M6: Pre-created character note handling
      if (options._preCreatedNote) {
          newNote = options._preCreatedNote;
          workspace.notes[newNote.id] = newNote;
          workspace.indexes.title_to_note_id[newNote.title] = newNote.id;
          workspace.indexes.backlinks[newNote.id] = [];
          logNotification(workspace, 'system', `Created character: ${newNote.title}`, newNote.id);
      } else {
          newNote = createNote(workspace, options);
          
          // Legacy M6 Init (Should be handled by new flow for Character, but keep fallback)
          if (newNote.recordKind === 'character' && !newNote.metadata?.characterData) {
              const now = Date.now();
              newNote.metadata = { 
                  ...newNote.metadata, 
                  characterData: {
                      templateId: 'default',
                      blocks: [],
                      forms: {
                          schemaVersion: 1,
                          activeFormId: 'base',
                          order: ['base'],
                          items: {
                              'base': {
                                  formId: 'base',
                                  name: 'Base',
                                  createdAt: now,
                                  updatedAt: now,
                                  overrides: {},
                                  localBlocks: []
                              }
                          }
                      },
                      snapshots: {
                          schemaVersion: 1,
                          activeSnapshotId: null,
                          order: [],
                          items: {}
                      }
                  }
              };
          }
      }

      setWorkspace({ ...workspace }); 
      vaultService.onNoteChange(newNote);
      
      // Open with correct view
      if (newNote.recordKind === 'character') {
           paneSystem.openTabInPane(paneSystem.state.focusedPaneId, {
              id: crypto.randomUUID(),
              kind: 'character',
              title: newNote.title,
              version: 1,
              payload: { noteId: newNote.id },
              state: { scrollY: 0 }
          });
      } else {
          paneSystem.openNoteTab(newNote.id, newNote.title);
      }
      
      setIsCreationModalOpen(false);
  };

  if (vaultState === 'initializing') return <div className="text-muted bg-bg h-screen flex items-center justify-center font-mono text-sm">Connecting to Cosmos...</div>;
  if (vaultState === 'no-vault') return <VaultPicker onReady={handleVaultReady} />;
  if (!workspace) return null;

  const renderNavigation = () => {
      switch(activeMode) {
          case 'notes': return <NotesNavigation workspace={workspace} onOpenNote={handleOpenNote} onCreateNote={handleCreateNoteTrigger} onUpdateWorkspace={handleUpdateWorkspace} activeNoteId={activeNoteId} state={navState.notes} onStateChange={(p) => setNavState(prev => ({ ...prev, notes: { ...prev.notes, ...p } }))} />;
          case 'starmap': return <StarMapNavigation workspace={workspace} onOpenMap={handleOpenMap} onUpdateWorkspace={handleUpdateWorkspace} />;
          case 'glossary': return <GlossaryNavigation workspace={workspace} onUpdateWorkspace={handleUpdateWorkspace} onOpenTerm={handleOpenTerm} onOpenPending={handleOpenPending} state={navState.glossary} onStateChange={(p) => setNavState(prev => ({ ...prev, glossary: { ...prev.glossary, ...p } }))} />;
          default: return null;
      }
  };

  return (
    <>
        <DevInvariantChecker paneSystem={paneSystem.state} widgetState={widgetState} />
        <AppShell
            sidebarState={sidebarState}
            onSidebarChange={(partial) => setSidebarState(prev => ({...prev, ...partial}))}
            activeMode={activeMode}
            onModeChange={(m) => setNavState(prev => ({...prev, activeMode: m}))}
            navigationPanel={renderNavigation()}
            widgetPanel={<WidgetBar workspace={workspace} activeNoteId={activeNoteId} activeTab={activeTab} activeMode={activeMode} onOpenNote={handleOpenNote} onOpenTerm={handleOpenTerm} onUpdateWorkspace={handleUpdateWorkspace} initialState={widgetState} onStateChange={setWidgetState} />}
            unresolvedCount={workspace.indexes.unresolved_note_ids.length}
            onSettingsOpen={() => setIsSettingsOpen(true)}
        >
            <PaneGrid 
                system={paneSystem.state}
                onFocusPane={paneSystem.focusPane}
                onCloseTab={paneSystem.closeTab}
                onClosePane={paneSystem.closePane}
                onSelectTab={paneSystem.setActiveTab}
                onReorderTab={paneSystem.reorderTab}
                onMoveTab={paneSystem.moveTabToPane}
                onUpdateTabState={paneSystem.updateTabState}
                handleDragToSplit={paneSystem.handleDragToSplit}
                workspace={workspace}
                onUpdateNote={handleUpdateNote}
                onGenerateTitle={handleGenerateTitle}
                onOpenNote={handleOpenNote}
                onOpenTerm={handleOpenTerm}
                onCreateNote={() => handleCreateNoteTrigger('inbox')}
                onOpenMap={handleOpenMap}
            />
        </AppShell>
        <NoteCreationModal isOpen={isCreationModalOpen} onClose={() => setIsCreationModalOpen(false)} onCreate={handleCreateNoteConfirm} workspace={workspace} />
        {isSettingsOpen && <SettingsModal workspace={workspace} onUpdateWorkspace={handleUpdateWorkspace} onClose={() => setIsSettingsOpen(false)} />}
    </>
  );
};

export default App;
