
import React, { useState, useEffect, useRef } from 'react';
import { Note, Workspace, PaneState, PaneId, UIState, MissingTab, NoteTab, SidebarState, NavigationState, WidgetSystemState, NotificationLogItem, SearchFilters } from './types';
import { createNote, updateNote, logNotification } from './services/storageService'; 
import { vaultService } from './services/vaultService';
import { generateTitle } from './services/geminiService';
import Layout from './components/Layout';
import { usePaneSystem } from './hooks/usePaneSystem';
import { PaneGrid } from './components/PaneSystem';
import NoteCreationModal from './components/NoteCreationModal';
import VaultPicker from './components/VaultPicker';

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
    selectedSection: null, 
    folderOpenState: {},
    searchState: {
        query: '',
        filters: DEFAULT_SEARCH_FILTERS,
        isFiltersOpen: false
    }
};

const DEFAULT_WIDGET_STATE: WidgetSystemState = { openWidgetIds: ['outline', 'backlinks'], widgetStates: {} };

const App: React.FC = () => {
  const [vaultState, setVaultState] = useState<VaultState>('initializing');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  
  // -- UI State Containers --
  const [sidebarState, setSidebarState] = useState<SidebarState>(DEFAULT_SIDEBAR_STATE);
  const [navState, setNavState] = useState<NavigationState>(DEFAULT_NAV_STATE);
  const [widgetState, setWidgetState] = useState<WidgetSystemState>(DEFAULT_WIDGET_STATE);
  
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [creationTargetFolderId, setCreationTargetFolderId] = useState<string>('inbox');
  const paneSystem = usePaneSystem();

  // --- Vault Initialization & Restore ---
  useEffect(() => {
      const init = async () => {
          const status = await vaultService.initialize();
          if (status === 'active') {
              try {
                  const ws = await vaultService.loadWorkspace();
                  const uiState = await vaultService.loadUIState();
                  
                  if (uiState) {
                      let missingCount = 0;
                      Object.values(uiState.paneSystem.panes).forEach((pane: PaneState) => {
                          pane.tabs = pane.tabs.map(tab => {
                              if (tab.kind === 'note') {
                                  const noteTab = tab as NoteTab;
                                  const note = ws.notes[noteTab.payload.noteId];
                                  if (note) {
                                      return { ...tab, title: note.title };
                                  } else {
                                      missingCount++;
                                      logNotification(ws, 'warning', `Restored workspace referenced missing note: ${tab.title || noteTab.payload.noteId}`, undefined);
                                      return {
                                          ...tab,
                                          kind: 'missing',
                                          title: 'Missing: ' + tab.title,
                                          payload: {
                                              originalKind: 'note',
                                              originalId: noteTab.payload.noteId,
                                              lastKnownTitle: tab.title
                                          }
                                      } as MissingTab;
                                  }
                              }
                              return tab;
                          });
                      });

                      paneSystem.restoreState(uiState.paneSystem);
                      setSidebarState(uiState.layout || DEFAULT_SIDEBAR_STATE);
                      
                      // Merge nav state to ensure new properties like searchState exist
                      setNavState({ ...DEFAULT_NAV_STATE, ...(uiState.navigation || {}) });
                      
                      setWidgetState(uiState.widgets || DEFAULT_WIDGET_STATE);

                      if (missingCount > 0) {
                          vaultService.onWorkspaceChange(ws); 
                      }
                  } else {
                      const notes = (Object.values(ws.notes) as Note[]).sort((a, b) => b.updatedAt - a.updatedAt);
                      if (notes.length > 0) {
                          paneSystem.openNoteTab(notes[0].id, notes[0].title);
                      } else {
                          paneSystem.openStarMapTab();
                      }
                  }

                  setWorkspace(ws);
                  setVaultState('active');
              } catch (e) {
                  console.error("Failed to load vault workspace", e);
                  setVaultState('no-vault');
              }
          } else {
              setVaultState('no-vault');
          }
      };
      init();
  }, []);

  // --- Persistence: UI State ---
  useEffect(() => {
      if (vaultState === 'active' && workspace) {
          const currentUIState: UIState = {
              schemaVersion: 1,
              savedAt: Date.now(),
              paneSystem: paneSystem.state,
              layout: sidebarState,
              navigation: navState,
              widgets: widgetState
          };
          vaultService.debouncedSaveUIState(currentUIState);
      }
  }, [paneSystem.state, sidebarState, navState, widgetState, vaultState, workspace]);


  // --- Handlers for Vault Picker ---
  const handleVaultReady = async () => {
      const ws = await vaultService.loadWorkspace();
      setWorkspace(ws);
      setVaultState('active');
      paneSystem.openStarMapTab(); 
  };

  // --- Sync Effects ---
  useEffect(() => {
    if (workspace && vaultState === 'active') {
        vaultService.onWorkspaceChange(workspace);
    }
  }, [workspace, vaultState]);

  // --- Global Keyboard Shortcuts ---
  // Uses hotkeys.json bindings if available
  useEffect(() => {
      if (!workspace) return;

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          const { bindings } = workspace.hotkeys;
          
          const match = bindings.find(b => {
              if (!b.enabled) return false;
              
              const parts = b.keys.toLowerCase().split('+');
              const key = parts.pop();
              const mod = parts.includes('mod') || parts.includes('ctrl') || parts.includes('cmd');
              const shift = parts.includes('shift');
              const alt = parts.includes('alt');

              const eventMod = e.metaKey || e.ctrlKey;
              return e.key.toLowerCase() === key && eventMod === mod && e.shiftKey === shift && e.altKey === alt;
          });

          if (match) {
              e.preventDefault();
              
              // Global App Commands
              if (match.command === 'note.new') {
                  setCreationTargetFolderId('inbox');
                  setIsCreationModalOpen(true);
                  return;
              }
              
              // Dispatch to focused editor or other components
              const event = new CustomEvent('app-command', { detail: { command: match.command } });
              window.dispatchEvent(event);
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [workspace]);

  // Sync tab titles active logic
  useEffect(() => {
      if (!workspace) return;
      
      const updates: { paneId: any, tabId: string, title: string }[] = [];
      (Object.entries(paneSystem.state.panes) as [PaneId, PaneState][]).forEach(([paneId, pane]) => {
          pane.tabs.forEach(tab => {
              if (tab.kind === 'note') {
                  const note = workspace.notes[(tab as NoteTab).payload.noteId];
                  if (note && tab.title !== note.title) {
                       updates.push({ paneId, tabId: tab.id, title: note.title });
                  }
              }
          });
      });
      updates.forEach(u => paneSystem.updateTabState(u.paneId, u.tabId, { title: u.title } as any));
  }, [workspace]);

  // --- Render Gates ---

  if (vaultState === 'initializing') return <div className="text-muted bg-chrome-bg h-screen flex items-center justify-center font-mono text-sm">Connecting to Cosmos...</div>;
  if (vaultState === 'no-vault') return <VaultPicker onReady={handleVaultReady} />;
  if (!workspace) return null;

  // --- Handlers ---

  const handleCreateNoteTrigger = (folderId: string = 'inbox') => {
      setCreationTargetFolderId(folderId);
      setIsCreationModalOpen(true);
  };

  const handleCreateNoteConfirm = (options: any) => {
      if (!workspace) return;
      const newNote = createNote(workspace, options);
      
      // Update local state
      setWorkspace({ ...workspace }); 
      
      // Persist Note immediately
      vaultService.onNoteChange(newNote);

      paneSystem.openNoteTab(newNote.id, newNote.title);
      setIsCreationModalOpen(false);
  };

  const handleUpdateNote = (updatedNote: Note, updatedWorkspace?: Workspace) => {
    setWorkspace(prev => {
        if (!prev) return null;
        let nextWorkspace = updatedWorkspace ? { ...updatedWorkspace } : { ...prev };
        nextWorkspace = updateNote(nextWorkspace, updatedNote);
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
      const note = workspace.notes[id];
      if (note) {
          // NOTE: We do NOT force load content here anymore. NoteEditor handles lazy load on mount.
          // This keeps open fast and UI responsive.
          paneSystem.openNoteTab(id, note.title);
      } else {
          paneSystem.openNoteTab(id, "Unresolved Link");
      }
  };

  const handleOpenMap = () => {
      paneSystem.openStarMapTab();
  };

  const focusedPane = paneSystem.state.panes[paneSystem.state.focusedPaneId];
  const activeTab = focusedPane.tabs.find(t => t.id === focusedPane.activeTabId);
  const activeNoteId = activeTab?.kind === 'note' ? (activeTab as NoteTab).payload.noteId : null;

  return (
    <>
        <Layout
            workspace={workspace}
            onOpenNote={handleOpenNote}
            onOpenMap={handleOpenMap}
            onCreateNote={handleCreateNoteTrigger}
            onUpdateWorkspace={handleUpdateWorkspace}
            activeNoteId={activeNoteId}
            activeTab={activeTab}
            initialSidebarState={sidebarState}
            onSidebarChange={(partial) => setSidebarState(prev => ({...prev, ...partial}))}
            initialNavState={navState}
            onNavChange={(partial) => setNavState(prev => ({...prev, ...partial}))}
            initialWidgetState={widgetState}
            onWidgetChange={setWidgetState}
        >
            <PaneGrid 
                system={paneSystem.state}
                onFocusPane={paneSystem.focusPane}
                onCloseTab={paneSystem.closeTab}
                onSelectTab={paneSystem.setActiveTab}
                onReorderTab={paneSystem.reorderTab}
                onMoveTab={paneSystem.moveTabToPane}
                onUpdateTabState={paneSystem.updateTabState}
                workspace={workspace}
                onUpdateNote={handleUpdateNote}
                onGenerateTitle={handleGenerateTitle}
                onOpenNote={handleOpenNote}
            />
        </Layout>
        
        <NoteCreationModal 
            isOpen={isCreationModalOpen}
            onClose={() => setIsCreationModalOpen(false)}
            onCreate={handleCreateNoteConfirm}
            workspace={workspace}
        />
    </>
  );
};

export default App;