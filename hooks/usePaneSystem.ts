
import { useState, useCallback } from 'react';
import { PaneSystemState, PaneLayout, PaneId, Tab, NoteTab, StarMapTab, GlossaryTab, SearchResultsTab, SearchFilters } from '../types';

const DEFAULT_STATE: PaneSystemState = {
    layout: 'single',
    focusedPaneId: 'paneA',
    panes: {
        paneA: { id: 'paneA', tabs: [], activeTabId: null, history: [] },
        paneB: { id: 'paneB', tabs: [], activeTabId: null, history: [] },
        paneC: { id: 'paneC', tabs: [], activeTabId: null, history: [] },
        paneD: { id: 'paneD', tabs: [], activeTabId: null, history: [] },
    },
    paneOrder: ['paneA', 'paneB', 'paneC', 'paneD']
};

export const usePaneSystem = () => {
    const [state, setState] = useState<PaneSystemState>(DEFAULT_STATE);

    // --- Restore Action ---
    const restoreState = (newState: PaneSystemState) => {
        if (!newState || !newState.panes) {
             setState(DEFAULT_STATE);
        } else {
             const safeFocus = newState.panes[newState.focusedPaneId] ? newState.focusedPaneId : 'paneA';
             setState({ ...newState, focusedPaneId: safeFocus });
        }
    };

    // --- Layout Visibility Helper ---
    const getVisiblePanes = (layout: PaneLayout): PaneId[] => {
        switch(layout) {
            case 'single': return ['paneA'];
            case 'splitVertical': return ['paneA', 'paneB'];
            case 'splitHorizontal': return ['paneA', 'paneC']; // A on top, C on bottom
            case 'quad': return ['paneA', 'paneB', 'paneC', 'paneD'];
        }
    };

    // --- Layout Actions ---
    const setLayout = (layout: PaneLayout) => {
        setState(prev => {
            const visible = getVisiblePanes(layout);
            let nextFocus = prev.focusedPaneId;
            if (!visible.includes(nextFocus)) {
                nextFocus = visible[0] || 'paneA';
            }
            return { ...prev, layout, focusedPaneId: nextFocus };
        });
    };

    const focusPane = (paneId: PaneId) => {
        setState(prev => {
            const visible = getVisiblePanes(prev.layout);
            if (!visible.includes(paneId)) return prev; 
            return { ...prev, focusedPaneId: paneId };
        });
    };

    // --- Close Pane Logic (Deterministic Reduction) ---
    const closePane = (paneId: PaneId) => {
        setState(prev => {
            const visible = getVisiblePanes(prev.layout);
            // Validation: Pane must be visible and empty to close via this explicit action
            if (!visible.includes(paneId)) return prev;
            if (prev.panes[paneId].tabs.length > 0) return prev; // Safety: only empty panes

            let newLayout = prev.layout;
            let moveMap: Array<{from: PaneId, to: PaneId}> = [];
            let newFocus = prev.focusedPaneId;

            // Strategy: Reduce layout and merge remaining panes into new slots
            // Always map: A->A, B->B (Vertical) or B->A (Single), etc.
            
            if (prev.layout === 'splitVertical') { // A | B
                // If closing A: B moves to A. Layout -> Single.
                // If closing B: Layout -> Single.
                newLayout = 'single';
                if (paneId === 'paneA') {
                    moveMap.push({ from: 'paneB', to: 'paneA' });
                    // B is now empty conceptually, focus A
                    newFocus = 'paneA';
                } else {
                    // Closed B. A remains A. Focus A.
                    newFocus = 'paneA';
                }
            } else if (prev.layout === 'splitHorizontal') { // A / C
                newLayout = 'single';
                if (paneId === 'paneA') {
                    moveMap.push({ from: 'paneC', to: 'paneA' });
                    newFocus = 'paneA';
                } else {
                    newFocus = 'paneA';
                }
            } else if (prev.layout === 'quad') { // A B / C D
                // Default reduction to Vertical (Col A, Col B)
                newLayout = 'splitVertical'; 
                // Col 1: A, C. Col 2: B, D.
                // If closing A: Merge C -> A. Keep B, D.
                // If closing C: Keep A. Keep B, D.
                // If closing B: Keep A, C. Merge D -> B.
                // If closing D: Keep A, C. Keep B.
                
                // Note: We are reducing to Vertical which uses 'paneA' and 'paneB'.
                // So C and D *must* move to A or B regardless of who was closed, unless we want to lose them (which we don't).
                
                // Mappings for Quad -> Vertical:
                // Old A -> New A
                // Old C -> New A
                // Old B -> New B
                // Old D -> New B
                
                // We construct the move map based on this general rule, 
                // but we don't need to move if the target is same (A->A).
                // We only move C->A, D->B.
                // The pane that was "closed" is empty, so moving TO it is fine (it becomes the container).
                // Moving FROM it is fine (it's empty).
                
                moveMap.push({ from: 'paneC', to: 'paneA' });
                moveMap.push({ from: 'paneD', to: 'paneB' });
                
                // Determine focus
                // If we were focused on A or C, new focus is A.
                // If we were focused on B or D, new focus is B.
                if (prev.focusedPaneId === 'paneA' || prev.focusedPaneId === 'paneC') newFocus = 'paneA';
                else newFocus = 'paneB';
            } else {
                // Single pane close -> no op
                return prev;
            }

            // Execute State Update
            const nextPanes = { ...prev.panes };
            
            // Apply Moves
            moveMap.forEach(({ from, to }) => {
                const source = prev.panes[from];
                const dest = nextPanes[to]; // Modify the working copy
                
                // Check dupes when merging
                const mergedTabs = [...dest.tabs];
                source.tabs.forEach(tab => {
                    const exists = mergedTabs.some(t => {
                        if (t.kind !== tab.kind) return false;
                        if (t.kind === 'note') return (t as NoteTab).payload.noteId === (tab as NoteTab).payload.noteId;
                        return false; // Simplify
                    });
                    if (!exists) mergedTabs.push(tab);
                });
                
                // Update Dest
                nextPanes[to] = {
                    ...dest,
                    tabs: mergedTabs,
                    // If dest had no active tab, take source's?
                    activeTabId: dest.activeTabId || source.activeTabId,
                    history: [...dest.history, ...source.history] // Simple merge
                };
                
                // Clear Source (it effectively disappears from layout, but we clear state to be clean)
                nextPanes[from] = { ...source, tabs: [], activeTabId: null, history: [] };
            });

            return {
                ...prev,
                layout: newLayout,
                focusedPaneId: newFocus,
                panes: nextPanes
            };
        });
    };

    // --- Tab Opening Logic ---
    const openTabInPane = useCallback((paneId: PaneId, newTab: Tab) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            
            let existingTab = pane.tabs.find(t => {
                if (t.kind !== newTab.kind) return false;
                if (t.kind === 'note' && newTab.kind === 'note') return (t as NoteTab).payload.noteId === (newTab as NoteTab).payload.noteId;
                if (t.kind === 'starmap' && newTab.kind === 'starmap') return (t as StarMapTab).payload.mapId === (newTab as StarMapTab).payload.mapId;
                if (t.kind === 'glossary' && newTab.kind === 'glossary') return (t as GlossaryTab).payload.scope === (newTab as GlossaryTab).payload.scope;
                if (t.kind === 'search' && newTab.kind === 'search') return (t as SearchResultsTab).payload.query === (newTab as SearchResultsTab).payload.query; // Rudimentary check
                return false;
            });

            if (existingTab) {
                return {
                    ...prev,
                    focusedPaneId: paneId,
                    panes: { ...prev.panes, [paneId]: { ...pane, activeTabId: existingTab.id, history: [...pane.history.filter(h => h !== existingTab!.id), existingTab.id] } }
                };
            }

            return {
                ...prev,
                focusedPaneId: paneId,
                panes: { ...prev.panes, [paneId]: { ...pane, tabs: [...pane.tabs, newTab], activeTabId: newTab.id, history: [...pane.history, newTab.id] } }
            };
        });
    }, []);

    // --- Helper Openers ---
    const openNoteTab = (noteId: string, title: string) => {
        const tab: NoteTab = { id: crypto.randomUUID(), kind: 'note', title: title || "Untitled", version: 1, payload: { noteId }, state: { readMode: false, scrollY: 0 } };
        openTabInPane(state.focusedPaneId, tab);
    };

    const openStarMapTab = () => {
        const tab: StarMapTab = { id: crypto.randomUUID(), kind: 'starmap', title: "Cosmos", version: 1, payload: { mapId: 'main' }, state: { zoom: 1, panX: 0, panY: 0, selectedNodeId: null } };
        openTabInPane(state.focusedPaneId, tab);
    };

    const openGlossaryTab = () => {
        const tab: GlossaryTab = { id: crypto.randomUUID(), kind: 'glossary', title: "Glossary", version: 1, payload: { scope: 'all' }, state: { search: '', selectedTermId: null, scrollY: 0 } };
        openTabInPane(state.focusedPaneId, tab);
    };

    const openSearchResultsTab = (query: string, filters: SearchFilters) => {
        const tab: SearchResultsTab = { id: crypto.randomUUID(), kind: 'search', title: `Search: ${query || 'All'}`, version: 1, payload: { query, filters }, state: { scrollY: 0 } };
        openTabInPane(state.focusedPaneId, tab);
    };

    // --- Tab Management ---
    const updateTabState = useCallback((paneId: PaneId, tabId: string, partialState: any) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            const tabIndex = pane.tabs.findIndex(t => t.id === tabId);
            if (tabIndex === -1) return prev;
            const updatedTabs = [...pane.tabs];
            updatedTabs[tabIndex] = { ...updatedTabs[tabIndex], state: { ...updatedTabs[tabIndex].state, ...partialState } };
            return { ...prev, panes: { ...prev.panes, [paneId]: { ...pane, tabs: updatedTabs } } };
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
            if (pane.activeTabId === tabId) {
                if (newTabs.length === 0) newActiveId = null;
                else if (tabIndex < pane.tabs.length - 1) newActiveId = newTabs[tabIndex].id; 
                else if (tabIndex > 0) newActiveId = newTabs[tabIndex - 1].id;
                else { const lastActive = newHistory[newHistory.length - 1]; newActiveId = lastActive || newTabs[0].id; }
            }
            return { ...prev, panes: { ...prev.panes, [paneId]: { ...pane, tabs: newTabs, activeTabId: newActiveId, history: newActiveId ? [...newHistory, newActiveId] : newHistory } } };
        });
    };

    const setActiveTab = (paneId: PaneId, tabId: string) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            return { ...prev, focusedPaneId: paneId, panes: { ...prev.panes, [paneId]: { ...pane, activeTabId: tabId, history: [...pane.history.filter(h => h !== tabId), tabId] } } };
        });
    };

    // --- Drag/Reorder (simplified reuse) ---
    const reorderTab = (paneId: PaneId, oldIndex: number, newIndex: number) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            const newTabs = [...pane.tabs];
            const [movedTab] = newTabs.splice(oldIndex, 1);
            newTabs.splice(newIndex, 0, movedTab);
            return { ...prev, panes: { ...prev.panes, [paneId]: { ...pane, tabs: newTabs } } };
        });
    };

    const moveTabToPane = (sourcePaneId: PaneId, targetPaneId: PaneId, tabId: string, targetIndex?: number) => {
        setState(prev => {
            const sourcePane = prev.panes[sourcePaneId];
            const targetPane = prev.panes[targetPaneId];
            const tab = sourcePane.tabs.find(t => t.id === tabId);
            if (!tab) return prev;

            const sourceTabs = sourcePane.tabs.filter(t => t.id !== tabId);
            let sourceActiveId = sourcePane.activeTabId;
            if (sourcePane.activeTabId === tabId) {
                if (sourceTabs.length === 0) sourceActiveId = null;
                else {
                    const idx = sourcePane.tabs.findIndex(t => t.id === tabId);
                    if (idx < sourcePane.tabs.length - 1) sourceActiveId = sourceTabs[idx].id;
                    else if (idx > 0) sourceActiveId = sourceTabs[idx - 1].id;
                    else sourceActiveId = sourceTabs[0].id;
                }
            }

            const existingInTarget = targetPane.tabs.find(t => {
                if (t.kind !== tab.kind) return false;
                if (t.kind === 'note') return (t as NoteTab).payload.noteId === (tab as NoteTab).payload.noteId;
                if (t.kind === 'starmap') return (t as StarMapTab).payload.mapId === (tab as StarMapTab).payload.mapId;
                return false; 
            });

            let targetTabs = [...targetPane.tabs];
            let newActiveTargetId = tab.id;

            if (existingInTarget) {
                newActiveTargetId = existingInTarget.id;
            } else {
                if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= targetTabs.length) targetTabs.splice(targetIndex, 0, tab);
                else targetTabs.push(tab);
            }

            return {
                ...prev,
                focusedPaneId: targetPaneId,
                panes: {
                    ...prev.panes,
                    [sourcePaneId]: { ...sourcePane, tabs: sourceTabs, activeTabId: sourceActiveId, history: sourceActiveId ? [...sourcePane.history.filter(h => h !== tabId)] : [] },
                    [targetPaneId]: { ...targetPane, tabs: targetTabs, activeTabId: newActiveTargetId, history: [...targetPane.history, newActiveTargetId] }
                }
            };
        });
    };

    const handleDragToSplit = (sourcePaneId: PaneId, tabId: string, direction: 'right' | 'bottom') => {
        // ... (existing logic from prev step, just ensure it uses correct move logic)
        setState(prev => {
            let nextLayout = prev.layout;
            let targetPaneId: PaneId = sourcePaneId;

            if (prev.layout === 'single') {
                if (direction === 'right') { nextLayout = 'splitVertical'; targetPaneId = 'paneB'; }
                else if (direction === 'bottom') { nextLayout = 'splitHorizontal'; targetPaneId = 'paneC'; }
            } else if (prev.layout === 'splitVertical') {
                if (direction === 'bottom') { nextLayout = 'quad'; targetPaneId = sourcePaneId === 'paneA' ? 'paneC' : 'paneD'; }
                else if (direction === 'right' && sourcePaneId === 'paneA') targetPaneId = 'paneB';
            } else if (prev.layout === 'splitHorizontal') {
                if (direction === 'right') { nextLayout = 'quad'; targetPaneId = sourcePaneId === 'paneA' ? 'paneB' : 'paneD'; }
                else if (direction === 'bottom' && sourcePaneId === 'paneA') targetPaneId = 'paneC';
            } else if (prev.layout === 'quad') {
                if (direction === 'right') { if (sourcePaneId === 'paneA') targetPaneId = 'paneB'; if (sourcePaneId === 'paneC') targetPaneId = 'paneD'; }
                if (direction === 'bottom') { if (sourcePaneId === 'paneA') targetPaneId = 'paneC'; if (sourcePaneId === 'paneB') targetPaneId = 'paneD'; }
            }

            const sourcePane = prev.panes[sourcePaneId];
            const targetPane = prev.panes[targetPaneId];
            const tab = sourcePane.tabs.find(t => t.id === tabId);
            
            if (!tab || sourcePaneId === targetPaneId) return { ...prev, layout: nextLayout };

            const sourceTabs = sourcePane.tabs.filter(t => t.id !== tabId);
            let sourceActiveId = sourcePane.activeTabId;
            if (sourcePane.activeTabId === tabId) {
                if (sourceTabs.length === 0) sourceActiveId = null;
                else {
                    const idx = sourcePane.tabs.findIndex(t => t.id === tabId);
                    if (idx < sourcePane.tabs.length - 1) sourceActiveId = sourceTabs[idx].id;
                    else if (idx > 0) sourceActiveId = sourceTabs[idx - 1].id;
                    else sourceActiveId = sourceTabs[0].id;
                }
            }

            const existingInTarget = targetPane.tabs.find(t => {
                if (t.kind !== tab.kind) return false;
                if (t.kind === 'note') return (t as NoteTab).payload.noteId === (tab as NoteTab).payload.noteId;
                if (t.kind === 'starmap') return (t as StarMapTab).payload.mapId === (tab as StarMapTab).payload.mapId;
                return false;
            });

            let targetTabs = [...targetPane.tabs];
            let newActiveTargetId = tab.id;

            if (existingInTarget) { newActiveTargetId = existingInTarget.id; } else { targetTabs.push(tab); }

            return {
                ...prev,
                layout: nextLayout,
                focusedPaneId: targetPaneId,
                panes: {
                    ...prev.panes,
                    [sourcePaneId]: { ...sourcePane, tabs: sourceTabs, activeTabId: sourceActiveId, history: sourceActiveId ? [...sourcePane.history.filter(h => h !== tabId)] : [] },
                    [targetPaneId]: { ...targetPane, tabs: targetTabs, activeTabId: newActiveTargetId, history: [...targetPane.history, newActiveTargetId] }
                }
            };
        });
    };

    const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        setState(prev => {
            const current = prev.focusedPaneId;
            let next = current;
            const layout = prev.layout;
            if (layout === 'single') return prev;
            if (layout === 'splitVertical') { 
                if (direction === 'right' && current === 'paneA') next = 'paneB';
                if (direction === 'left' && current === 'paneB') next = 'paneA';
            } else if (layout === 'splitHorizontal') {
                if (direction === 'down' && current === 'paneA') next = 'paneC';
                if (direction === 'up' && current === 'paneC') next = 'paneA';
            } else if (layout === 'quad') {
                 switch (current) {
                     case 'paneA': if (direction === 'right') next = 'paneB'; if (direction === 'down') next = 'paneC'; break;
                     case 'paneB': if (direction === 'left') next = 'paneA'; if (direction === 'down') next = 'paneD'; break;
                     case 'paneC': if (direction === 'right') next = 'paneD'; if (direction === 'up') next = 'paneA'; break;
                     case 'paneD': if (direction === 'left') next = 'paneC'; if (direction === 'up') next = 'paneB'; break;
                 }
            }
            return next !== current ? { ...prev, focusedPaneId: next } : prev;
        });
    }, []);

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
            return { ...prev, panes: { ...prev.panes, [paneId]: { ...pane, activeTabId: nextTabId, history: [...pane.history.filter(h => h !== nextTabId), nextTabId] } } };
        });
    };

    const closeFocusedTab = () => state.focusedPaneId; // Helper

    return {
        state,
        restoreState, 
        setLayout,
        focusPane,
        openNoteTab,
        openStarMapTab,
        openGlossaryTab,
        openSearchResultsTab,
        closeTab,
        closePane,
        setActiveTab,
        reorderTab,
        moveTabToPane,
        updateTabState,
        moveFocus,
        cycleTab,
        closeFocusedTab,
        handleDragToSplit
    };
};
