
import { useState, useEffect, useCallback } from 'react';
import { PaneSystemState, PaneLayout, PaneId, Tab, TabKind, NoteTab, StarMapTab, GlossaryTab } from '../types';

const DEFAULT_STATE: PaneSystemState = {
    layout: 'single',
    focusedPaneId: 'paneA',
    panes: {
        paneA: { id: 'paneA', tabs: [], activeTabId: null, history: [] },
        paneB: { id: 'paneB', tabs: [], activeTabId: null, history: [] },
        paneC: { id: 'paneC', tabs: [], activeTabId: null, history: [] },
        paneD: { id: 'paneD', tabs: [], activeTabId: null, history: [] },
    }
};

export const usePaneSystem = () => {
    const [state, setState] = useState<PaneSystemState>(DEFAULT_STATE);

    // Removed: localStorage.getItem effect to support strict vault-based state

    // --- Restore Action ---
    const restoreState = (newState: PaneSystemState) => {
        // Validation could be added here, for now trust the incoming object or fallback
        if (!newState || !newState.panes) {
             setState(DEFAULT_STATE);
        } else {
             setState(newState);
        }
    };

    // --- Helpers ---
    
    const getVisiblePanes = (layout: PaneLayout): PaneId[] => {
        switch(layout) {
            case 'single': return ['paneA'];
            case 'splitVertical': return ['paneA', 'paneB'];
            case 'splitHorizontal': return ['paneA', 'paneC'];
            case 'grid': return ['paneA', 'paneB', 'paneC', 'paneD'];
        }
    };

    // --- Layout Actions ---

    const setLayout = (layout: PaneLayout) => {
        setState(prev => {
            const visible = getVisiblePanes(layout);
            let nextFocus = prev.focusedPaneId;
            if (!visible.includes(nextFocus)) {
                nextFocus = 'paneA';
            }
            return { ...prev, layout, focusedPaneId: nextFocus };
        });
    };

    const focusPane = (paneId: PaneId) => {
        setState(prev => ({ ...prev, focusedPaneId: paneId }));
    };

    // --- Universal Tab Opening Logic ---
    
    const openTabInFocusedPane = useCallback((newTab: Tab) => {
        setState(prev => {
            const paneId = prev.focusedPaneId;
            const pane = prev.panes[paneId];
            
            // Deduplication Logic
            let existingTab = pane.tabs.find(t => {
                if (t.kind !== newTab.kind) return false;
                if (t.kind === 'note' && newTab.kind === 'note') {
                    return (t as NoteTab).payload.noteId === (newTab as NoteTab).payload.noteId;
                }
                if (t.kind === 'starmap' && newTab.kind === 'starmap') {
                    return (t as StarMapTab).payload.mapId === (newTab as StarMapTab).payload.mapId;
                }
                if (t.kind === 'glossary' && newTab.kind === 'glossary') {
                    return (t as GlossaryTab).payload.scope === (newTab as GlossaryTab).payload.scope;
                }
                return false;
            });

            if (existingTab) {
                return {
                    ...prev,
                    panes: {
                        ...prev.panes,
                        [paneId]: {
                            ...pane,
                            activeTabId: existingTab.id,
                            history: [...pane.history.filter(h => h !== existingTab!.id), existingTab.id]
                        }
                    }
                };
            }

            return {
                ...prev,
                panes: {
                    ...prev.panes,
                    [paneId]: {
                        ...pane,
                        tabs: [...pane.tabs, newTab],
                        activeTabId: newTab.id,
                        history: [...pane.history, newTab.id]
                    }
                }
            };
        });
    }, []);

    // --- Helper Openers ---

    const openNoteTab = (noteId: string, title: string) => {
        const tab: NoteTab = {
            id: crypto.randomUUID(),
            kind: 'note',
            title: title || "Untitled",
            version: 1,
            payload: { noteId },
            state: { readMode: false, scrollY: 0 }
        };
        openTabInFocusedPane(tab);
    };

    const openStarMapTab = () => {
        const tab: StarMapTab = {
            id: crypto.randomUUID(),
            kind: 'starmap',
            title: "Cosmos",
            version: 1,
            payload: { mapId: 'main' },
            state: { zoom: 1, panX: 0, panY: 0, selectedNodeId: null }
        };
        openTabInFocusedPane(tab);
    };

    const openGlossaryTab = () => {
        const tab: GlossaryTab = {
            id: crypto.randomUUID(),
            kind: 'glossary',
            title: "Glossary",
            version: 1,
            payload: { scope: 'all' },
            state: { search: '', selectedTermId: null, scrollY: 0 }
        };
        openTabInFocusedPane(tab);
    };

    // --- Tab Management ---

    const updateTabState = useCallback((paneId: PaneId, tabId: string, partialState: any) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            const tabIndex = pane.tabs.findIndex(t => t.id === tabId);
            if (tabIndex === -1) return prev;

            const updatedTabs = [...pane.tabs];
            updatedTabs[tabIndex] = {
                ...updatedTabs[tabIndex],
                state: { ...updatedTabs[tabIndex].state, ...partialState }
            };

            return {
                ...prev,
                panes: {
                    ...prev.panes,
                    [paneId]: { ...pane, tabs: updatedTabs }
                }
            };
        });
    }, []);

    const closeTab = (paneId: PaneId, tabId: string) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            const tabIndex = pane.tabs.findIndex(t => t.id === tabId);
            if (tabIndex === -1) return prev;

            const newTabs = pane.tabs.filter(t => t.id !== tabId);
            const newHistory = pane.history.filter(h => h !== tabId);
            
            let newActiveId = pane.activeTabId;
            
            // Nearest Neighbor Logic
            if (pane.activeTabId === tabId) {
                if (newTabs.length === 0) {
                    newActiveId = null;
                } else {
                    const nextIndex = Math.max(0, tabIndex - 1);
                    newActiveId = newTabs[nextIndex] ? newTabs[nextIndex].id : newTabs[0].id;
                }
            }

            return {
                ...prev,
                focusedPaneId: paneId,
                panes: {
                    ...prev.panes,
                    [paneId]: {
                        ...pane,
                        tabs: newTabs,
                        activeTabId: newActiveId,
                        history: newActiveId ? [...newHistory, newActiveId] : newHistory
                    }
                }
            };
        });
    };

    const setActiveTab = (paneId: PaneId, tabId: string) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            return {
                ...prev,
                focusedPaneId: paneId,
                panes: {
                    ...prev.panes,
                    [paneId]: {
                        ...pane,
                        activeTabId: tabId,
                        history: [...pane.history.filter(h => h !== tabId), tabId]
                    }
                }
            };
        });
    };

    // --- Drag and Drop Actions ---

    const reorderTab = (paneId: PaneId, oldIndex: number, newIndex: number) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            const newTabs = [...pane.tabs];
            const [movedTab] = newTabs.splice(oldIndex, 1);
            newTabs.splice(newIndex, 0, movedTab);

            return {
                ...prev,
                panes: {
                    ...prev.panes,
                    [paneId]: { ...pane, tabs: newTabs }
                }
            };
        });
    };

    const moveTabToPane = (sourcePaneId: PaneId, targetPaneId: PaneId, tabId: string, targetIndex?: number) => {
        setState(prev => {
            const sourcePane = prev.panes[sourcePaneId];
            const targetPane = prev.panes[targetPaneId];
            const tab = sourcePane.tabs.find(t => t.id === tabId);
            
            if (!tab) return prev;

            const sourceTabs = sourcePane.tabs.filter(t => t.id !== tabId);
            const sourceHistory = sourcePane.history.filter(h => h !== tabId);
            
            let sourceActiveId = sourcePane.activeTabId;
            if (sourcePane.activeTabId === tabId) {
                const tabIndex = sourcePane.tabs.findIndex(t => t.id === tabId);
                if (sourceTabs.length === 0) {
                    sourceActiveId = null;
                } else {
                     const nextIndex = Math.max(0, tabIndex - 1);
                     sourceActiveId = sourceTabs[nextIndex] ? sourceTabs[nextIndex].id : sourceTabs[0].id;
                }
            }

            const targetTabs = [...targetPane.tabs];
            if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= targetTabs.length) {
                targetTabs.splice(targetIndex, 0, tab);
            } else {
                targetTabs.push(tab);
            }

            return {
                ...prev,
                focusedPaneId: targetPaneId,
                panes: {
                    ...prev.panes,
                    [sourcePaneId]: {
                        ...sourcePane,
                        tabs: sourceTabs,
                        activeTabId: sourceActiveId,
                        history: sourceActiveId ? [...sourceHistory, sourceActiveId] : sourceHistory
                    },
                    [targetPaneId]: {
                        ...targetPane,
                        tabs: targetTabs,
                        activeTabId: tab.id,
                        history: [...targetPane.history, tab.id]
                    }
                }
            };
        });
    };

    // --- Shortcuts Helpers ---

    const cycleTab = (direction: 'next' | 'prev') => {
        setState(prev => {
            const paneId = prev.focusedPaneId;
            const pane = prev.panes[paneId];
            if (pane.tabs.length <= 1) return prev;

            const currentIndex = pane.tabs.findIndex(t => t.id === pane.activeTabId);
            let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

            if (nextIndex >= pane.tabs.length) nextIndex = 0;
            if (nextIndex < 0) nextIndex = pane.tabs.length - 1;

            const nextTabId = pane.tabs[nextIndex].id;

            return {
                ...prev,
                panes: {
                    ...prev.panes,
                    [paneId]: {
                        ...pane,
                        activeTabId: nextTabId,
                        history: [...pane.history.filter(h => h !== nextTabId), nextTabId]
                    }
                }
            };
        });
    };

    const closeFocusedTab = () => {
        setState(prev => {
            const paneId = prev.focusedPaneId;
            const pane = prev.panes[paneId];
            if (!pane.activeTabId) return prev;
            
            // Re-implement close logic locally to avoid async state chaining issues
            const tabId = pane.activeTabId;
            const tabIndex = pane.tabs.findIndex(t => t.id === tabId);
            const newTabs = pane.tabs.filter(t => t.id !== tabId);
            const newHistory = pane.history.filter(h => h !== tabId);
            
            let newActiveId = null;
            if (newTabs.length > 0) {
                 const nextIndex = Math.max(0, tabIndex - 1);
                 newActiveId = newTabs[nextIndex] ? newTabs[nextIndex].id : newTabs[0].id;
            }

            return {
                ...prev,
                panes: {
                    ...prev.panes,
                    [paneId]: {
                        ...pane,
                        tabs: newTabs,
                        activeTabId: newActiveId,
                        history: newActiveId ? [...newHistory, newActiveId] : newHistory
                    }
                }
            };
        });
    };

    // --- Focus Movement ---
    
    const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        setState(prev => {
            const current = prev.focusedPaneId;
            let next = current;
            const layout = prev.layout;

            if (layout === 'single') return prev;

            if (layout === 'splitVertical') { // A | B
                if ((direction === 'right' && current === 'paneA') || (direction === 'left' && current === 'paneB')) {
                     next = current === 'paneA' ? 'paneB' : 'paneA';
                }
            } else if (layout === 'splitHorizontal') { // A over C
                if ((direction === 'down' && current === 'paneA') || (direction === 'up' && current === 'paneC')) {
                     next = current === 'paneA' ? 'paneC' : 'paneA';
                }
            } else if (layout === 'grid') {
                 switch (current) {
                     case 'paneA': 
                        if (direction === 'right') next = 'paneB';
                        if (direction === 'down') next = 'paneC';
                        break;
                     case 'paneB':
                        if (direction === 'left') next = 'paneA';
                        if (direction === 'down') next = 'paneD';
                        break;
                     case 'paneC':
                        if (direction === 'right') next = 'paneD';
                        if (direction === 'up') next = 'paneA';
                        break;
                     case 'paneD':
                        if (direction === 'left') next = 'paneC';
                        if (direction === 'up') next = 'paneB';
                        break;
                 }
            }

            return next !== current ? { ...prev, focusedPaneId: next } : prev;
        });
    }, []);

    // --- Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore inputs
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.altKey && e.shiftKey) {
                switch(e.key) {
                    case '1': setLayout('single'); break;
                    case '2': setLayout('splitVertical'); break;
                    case '3': setLayout('splitHorizontal'); break;
                    case '4': setLayout('grid'); break;
                }
            } else if (e.altKey && !e.shiftKey) {
                 // Pane Navigation
                switch(e.key) {
                    case 'ArrowUp': moveFocus('up'); break;
                    case 'ArrowDown': moveFocus('down'); break;
                    case 'ArrowLeft': moveFocus('left'); break;
                    case 'ArrowRight': moveFocus('right'); break;
                }
                // Tab Actions
                if (e.key === 'w') {
                     e.preventDefault();
                     closeFocusedTab();
                }
            } else if (e.ctrlKey) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    cycleTab(e.shiftKey ? 'prev' : 'next');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [moveFocus]);

    return {
        state,
        restoreState, // NEW
        setLayout,
        focusPane,
        openNoteTab,
        openStarMapTab,
        openGlossaryTab,
        closeTab,
        setActiveTab,
        reorderTab,
        moveTabToPane,
        updateTabState
    };
};
