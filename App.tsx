
import React, { useState, useEffect } from 'react';
import { Note, Workspace, PaneState, PaneId, UIState, MissingTab, NoteTab, SidebarState, NavigationState, WidgetSystemState, SearchFilters, GlossaryEntryTab } from './types';
import { createNote, updateNote, logNotification, createMap, createGlossaryTerm } from './services/storageService'; 
import { vaultService } from './services/vaultService';
import { generateTitle } from './services/geminiService';
import AppShell from './components/Layout'; // Imported as Layout but it's the shell
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
    collectionId: 'all',
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
      
      // Check for Glossary Term
      // Ideally IDs should have a prefix or check in glossary list
      // For now, check if it's a known Note ID
      if (workspace.notes[id]) {
          paneSystem.openNoteTab(id, workspace.notes[id].title);
          return;
      }
      
      // Fallback: Check if it's a Glossary Term ID (stored in terms)
      // This is a bit weak if IDs collide, but UUIDs prevent that.
      if (workspace.glossary.terms[id]) {
          paneSystem.openGlossaryEntryTab(id);
          return;
      }

      // If we reach here, it's an unresolved Note ID
      paneSystem.openNoteTab(id, "Unresolved Link");
  };

  const handleOpenMap = (mapId?: string) => {
      paneSystem.openStarMapTab();
  };

  const handleOpenGlossaryEntry = (termId: string) => {
      paneSystem.openGlossaryEntryTab(termId);
  };

  // --- Hotkeys ---
  useHotkeys(
      workspace as Workspace, 
      paneSystem,
      navState,
      (partial) => setNavState(prev => ({...prev, ...partial})),
      widgetState,
      setWidgetState,
      {
          saveNote: handleManualSave,
          findInNote: handleFind,
          newNote: () => {
              if (activeMode === 'starmap') { /* Map create */ }
              else if (activeMode === 'glossary') { /* Term create via nav panel usually */ }
              else handleCreateNoteTrigger();
          }
      }
  );

  // --- Lifecycle ---
  useEffect(() => {
      const init = async () => {
          const status = await vaultService.initialize();
          if (status === 'active') {
              try {
                  const ws = await vaultService.loadWorkspace();
                  const uiState = await vaultService.loadUIState();
                  
                  if (uiState) {
                      let missingCount = 0;
                      // Validate restored tabs
                      if (uiState.paneSystem && uiState.paneSystem.panes) {
                          Object.values(uiState.paneSystem.panes).forEach((pane: PaneState) => {
                              pane.tabs = pane.tabs.map(tab => {
                                  if (tab.kind === 'note') {
                                      const noteTab = tab as NoteTab;
                                      const note = ws.notes[noteTab.payload.noteId];
                                      if (note) {
                                          return { ...tab, title: note.title };
                                      } else {
                                          missingCount++;
                                          return {
                                              ...tab,
                                              kind: 'missing',
                                              title: 'Missing: ' + tab.title,
                                              payload: { ...noteTab.payload, originalKind: 'note', lastKnownTitle: tab.title }
                                          } as MissingTab;
                                      }
                                  } else if (tab.kind === 'glossary_entry') {
                                      const termTab = tab as GlossaryEntryTab;
                                      const term = ws.glossary.terms[termTab.payload.termId];
                                      if (term) return { ...tab, title: term.term };
                                      // If term missing, let it render the view which handles "Term not found" gracefully or convert to missing
                                      return tab;
                                  }
                                  return tab;
                              });
                          });
                          paneSystem.restoreState(uiState.paneSystem);
                      }

                      setSidebarState(uiState.layout || DEFAULT_SIDEBAR_STATE);
                      setNavState({ ...DEFAULT_NAV_STATE, ...(uiState.navigation || {}) });
                      setWidgetState(uiState.widgets || DEFAULT_WIDGET_STATE);

                      if (missingCount > 0) {
                          logNotification(ws, 'warning', `Restored workspace with ${missingCount} missing refs.`);
                          vaultService.onWorkspaceChange(ws); 
                      }
                  } else {
                      // Fresh Start
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

  // --- Persistence ---
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

  // Sync tab titles
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
              if (tab.kind === 'glossary_entry') {
                  const term = workspace.glossary.terms[(tab as GlossaryEntryTab).payload.termId];
                  if (term && tab.title !== term.term) {
                      updates.push({ paneId, tabId: tab.id, title: term.term });
                  }
              }
          });
      });
      updates.forEach(u => paneSystem.updateTabState(u.paneId, u.tabId, { title: u.title } as any));
  }, [workspace]);

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

  // --- Layout Toggle Listener ---
  useEffect(() => {
      const handleLayoutCommands = (e: CustomEvent) => {
          if (e.detail.command === 'toggle-nav-bar') {
              setSidebarState(prev => ({ ...prev, navCollapsed: !prev.navCollapsed }));
          }
          if (e.detail.command === 'toggle-widget-bar') {
              setSidebarState(prev => ({ ...prev, widgetCollapsed: !prev.widgetCollapsed }));
          }
      };
      window.addEventListener('app-command', handleLayoutCommands as any);
      return () => window.removeEventListener('app-command', handleLayoutCommands as any);
  }, []);

  const handleCreateNoteConfirm = (options: any) => {
      if (!workspace) return;
      const newNote = createNote(workspace, options);
      setWorkspace({ ...workspace }); 
      vaultService.onNoteChange(newNote);
      paneSystem.openNoteTab(newNote.id, newNote.title);
      setIsCreationModalOpen(false);
  };

  // --- Render Gates ---
  if (vaultState === 'initializing') return <div className="text-muted bg-chrome-bg h-screen flex items-center justify-center font-mono text-sm">Connecting to Cosmos...</div>;
  if (vaultState === 'no-vault') return <VaultPicker onReady={handleVaultReady} />;
  if (!workspace) return null;

  // --- Component Rendering Selectors ---
  const renderNavigation = () => {
      switch(activeMode) {
          case 'notes': return <NotesNavigation workspace={workspace} onOpenNote={handleOpenNote} onCreateNote={handleCreateNoteTrigger} onUpdateWorkspace={handleUpdateWorkspace} activeNoteId={activeNoteId} state={navState.notes} onStateChange={(p) => setNavState(prev => ({ ...prev, notes: { ...prev.notes, ...p } }))} />;
          case 'starmap': return <StarMapNavigation workspace={workspace} onOpenMap={handleOpenMap} onUpdateWorkspace={handleUpdateWorkspace} />;
          case 'glossary': return <GlossaryNavigation workspace={workspace} onUpdateWorkspace={handleUpdateWorkspace} onOpenTerm={handleOpenGlossaryEntry} />;
          default: return null;
      }
  };

  const renderWidgets = () => (
      <WidgetBar 
          workspace={workspace} 
          activeNoteId={activeNoteId} 
          activeTab={activeTab} 
          onOpenNote={handleOpenNote} 
          onUpdateWorkspace={handleUpdateWorkspace} 
          initialState={widgetState} 
          onStateChange={setWidgetState} 
      />
  );

  return (
    <>
        <DevInvariantChecker paneSystem={paneSystem.state} widgetState={widgetState} />
        
        <AppShell
            sidebarState={sidebarState}
            onSidebarChange={(partial) => setSidebarState(prev => ({...prev, ...partial}))}
            activeMode={activeMode}
            onModeChange={(m) => setNavState(prev => ({...prev, activeMode: m}))}
            navigationPanel={renderNavigation()}
            widgetPanel={renderWidgets()}
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
                onCreateNote={() => handleCreateNoteTrigger('inbox')}
                onOpenMap={handleOpenMap}
            />
        </AppShell>
        
        <NoteCreationModal 
            isOpen={isCreationModalOpen}
            onClose={() => setIsCreationModalOpen(false)}
            onCreate={handleCreateNoteConfirm}
            workspace={workspace}
        />

        {isSettingsOpen && (
            <SettingsModal 
                workspace={workspace} 
                onUpdateWorkspace={handleUpdateWorkspace} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        )}
    </>
  );
};

export default App;
