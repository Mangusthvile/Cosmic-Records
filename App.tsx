
import React, { useState, useEffect, useRef } from 'react';
import { Note, Workspace, PaneState, PaneId, UIState, MissingTab, NoteTab, SidebarState, NavigationState, WidgetSystemState, NotificationLogItem } from './types';
import { createNote, updateNote, logNotification } from './services/storageService'; // Logic helpers only
import { vaultService } from './services/vaultService';
import { generateTitle } from './services/geminiService';
import Layout from './components/Layout';
import { usePaneSystem } from './hooks/usePaneSystem';
import { PaneGrid } from './components/PaneSystem';
import NoteCreationModal from './components/NoteCreationModal';
import VaultPicker from './components/VaultPicker';

type VaultState = 'initializing' | 'no-vault' | 'active';

const DEFAULT_SIDEBAR_STATE: SidebarState = { navWidth: 300, navCollapsed: false, widgetWidth: 340, widgetCollapsed: false };
const DEFAULT_NAV_STATE: NavigationState = { selectedSection: null, folderOpenState: {} };
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
                  // 1. Load Workspace
                  const ws = await vaultService.loadWorkspace();
                  
                  // 2. Load UI State
                  const uiState = await vaultService.loadUIState();
                  
                  // 3. Restore / Resolve References
                  if (uiState) {
                      // Resolve Tabs vs Workspace
                      let missingCount = 0;
                      
                      Object.values(uiState.paneSystem.panes).forEach(pane => {
                          pane.tabs = pane.tabs.map(tab => {
                              if (tab.kind === 'note') {
                                  const noteTab = tab as NoteTab;
                                  const note = ws.notes[noteTab.payload.noteId];
                                  if (note) {
                                      // Update title in case it changed
                                      return { ...tab, title: note.title };
                                  } else {
                                      // Convert to Missing
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

                      // Hydrate React States
                      paneSystem.restoreState(uiState.paneSystem);
                      setSidebarState(uiState.layout || DEFAULT_SIDEBAR_STATE);
                      setNavState(uiState.navigation || DEFAULT_NAV_STATE);
                      setWidgetState(uiState.widgets || DEFAULT_WIDGET_STATE);

                      // If missing references found, save the log update
                      if (missingCount > 0) {
                          vaultService.onWorkspaceChange(ws); 
                      }
                  } else {
                      // Fallback: Default State (Single empty pane)
                      // Initial Tab Check logic from before moved here
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
  // We use a dedicated effect to aggregate and save UI State changes
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
      // Reload page to trigger full init cycle cleanly or re-run init logic
      // For SPA smoothness, we re-run init logic mostly
      const ws = await vaultService.loadWorkspace();
      setWorkspace(ws);
      setVaultState('active');
      // Note: In real app we'd reuse the restoration logic above, duplicate for MVP safety or extract method
      // For now, simpler to reload window if this was a real deployed app, but here we just set active.
      // Falls back to defaults.
      paneSystem.openStarMapTab(); 
  };

  // --- Sync Effects ---

  // Save Workspace Metadata on change via Service Debounce
  useEffect(() => {
    if (workspace && vaultState === 'active') {
        vaultService.onWorkspaceChange(workspace);
    }
  }, [workspace, vaultState]);

  // Global Keyboard Shortcuts
  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          // New Note: Ctrl/Cmd + N
          if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
              e.preventDefault();
              setCreationTargetFolderId('inbox');
              setIsCreationModalOpen(true);
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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

  const handleCreateNoteConfirm = (type: string, method: 'blank' | 'ai') => {
      if (!workspace) return;
      const newNote = createNote(workspace, "New Record", type, method, creationTargetFolderId);
      
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
        
        // Logical Update (Renaming, linking indexes)
        nextWorkspace = updateNote(nextWorkspace, updatedNote);
        
        // Persist Note
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
          // Trigger content load if needed
          vaultService.ensureNoteContent(id).then(content => {
              // We could force an update here if needed, but usually the editor handles it via `note` prop if it's referentially stable or if we update workspace.
              // For now, ensureNoteContent updates the object in memory cache.
              // We might need to force re-render if the user is ALREADY looking at it.
              // But handleOpenNote usually implies navigating TO it.
              if (note.content !== content) {
                  // Content loaded late
                   setWorkspace(prev => prev ? ({...prev, notes: {...prev.notes, [id]: {...note, content}}}) : null);
              }
          });
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
        />
    </>
  );
};

export default App;
