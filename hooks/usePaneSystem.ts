import { useState, useCallback } from 'react';
import { PaneSystemState, PaneLayout, PaneId, Tab, NoteTab, StarMapTab, GlossaryTab, SearchResultsTab, SearchFilters, PendingReviewTab, GlossaryEntryTab } from '../types';

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

    const restoreState = (newState: PaneSystemState) => {
        if (!newState || !newState.panes) setState(DEFAULT_STATE);
        else {
             const safeFocus = newState.panes[newState.focusedPaneId] ? newState.focusedPaneId : 'paneA';
             setState({ ...newState, focusedPaneId: safeFocus });
        }
    };

    const getVisiblePanes = (layout: PaneLayout): PaneId[] => {
        switch(layout) {
            case 'single': return ['paneA'];
            case 'splitVertical': return ['paneA', 'paneB'];
            case 'splitHorizontal': return ['paneA', 'paneC'];
            case 'quad': return ['paneA', 'paneB', 'paneC', 'paneD'];
        }
    };

    const setLayout = (layout: PaneLayout) => {
        setState(prev => {
            const visible = getVisiblePanes(layout);
            let nextFocus = prev.focusedPaneId;
            if (!visible.includes(nextFocus)) nextFocus = visible[0] || 'paneA';
            return { ...prev, layout, focusedPaneId: nextFocus };
        });
    };

    const focusPane = (paneId: PaneId) => {
        setState(prev => {
            if (!getVisiblePanes(prev.layout).includes(paneId)) return prev; 
            return { ...prev, focusedPaneId: paneId };
        });
    };

    const closePane = (paneId: PaneId) => {
        setState(prev => {
            const visible = getVisiblePanes(prev.layout);
            if (!visible.includes(paneId) || prev.panes[paneId].tabs.length > 0) return prev;

            let newLayout = prev.layout;
            let moveMap: Array<{from: PaneId, to: PaneId}> = [];
            let newFocus = prev.focusedPaneId;

            if (prev.layout === 'splitVertical') {
                newLayout = 'single';
                if (paneId === 'paneA') { moveMap.push({ from: 'paneB', to: 'paneA' }); newFocus = 'paneA'; }
                else { newFocus = 'paneA'; }
            } else if (prev.layout === 'splitHorizontal') {
                newLayout = 'single';
                if (paneId === 'paneA') { moveMap.push({ from: 'paneC', to: 'paneA' }); newFocus = 'paneA'; }
                else { newFocus = 'paneA'; }
            } else if (prev.layout === 'quad') {
                newLayout = 'splitVertical'; 
                moveMap.push({ from: 'paneC', to: 'paneA' });
                moveMap.push({ from: 'paneD', to: 'paneB' });
                if (prev.focusedPaneId === 'paneA' || prev.focusedPaneId === 'paneC') newFocus = 'paneA'; else newFocus = 'paneB';
            } else { return prev; }

            const nextPanes = { ...prev.panes };
            moveMap.forEach(({ from, to }) => {
                const source = prev.panes[from];
                const dest = nextPanes[to];
                const mergedTabs = [...dest.tabs];
                source.tabs.forEach(tab => {
                    const exists = mergedTabs.some(t => {
                        if (t.kind !== tab.kind) return false;
                        if (t.kind === 'note') return (t as NoteTab).payload.noteId === (tab as NoteTab).payload.noteId;
                        return false; 
                    });
                    if (!exists) mergedTabs.push(tab);
                });
                nextPanes[to] = { ...dest, tabs: mergedTabs, activeTabId: dest.activeTabId || source.activeTabId, history: [...dest.history, ...source.history] };
                nextPanes[from] = { ...source, tabs: [], activeTabId: null, history: [] };
            });

            return { ...prev, layout: newLayout, focusedPaneId: newFocus, panes: nextPanes };
        });
    };

    const openTabInPane = useCallback((targetPaneId: PaneId, newTab: Tab) => {
        setState(prev => {
            // SINGLETON CHECK: Scan ALL panes
            for (const pid of Object.keys(prev.panes) as PaneId[]) {
                const pane = prev.panes[pid];
                const existing = pane.tabs.find(t => {
                    if (t.kind !== newTab.kind) return false;
                    // Strict singleton for Note and Glossary Entry
                    if (t.kind === 'note' && newTab.kind === 'note') return (t as NoteTab).payload.noteId === (newTab as NoteTab).payload.noteId;
                    if (t.kind === 'glossary_term' && newTab.kind === 'glossary_term') return (t as GlossaryEntryTab).payload.termId === (newTab as GlossaryEntryTab).payload.termId;
                    // Loose singleton for maps (only one map for now anyway)
                    if (t.kind === 'starmap' && newTab.kind === 'starmap') return true; 
                    // Search can have multiple
                    return false;
                });

                if (existing) {
                    return {
                        ...prev, focusedPaneId: pid,
                        panes: { ...prev.panes, [pid]: { ...pane, activeTabId: existing.id, history: [...pane.history.filter(h => h !== existing.id), existing.id] } }
                    };
                }
            }

            const pane = prev.panes[targetPaneId];
            return {
                ...prev, focusedPaneId: targetPaneId,
                panes: { ...prev.panes, [targetPaneId]: { ...pane, tabs: [...pane.tabs, newTab], activeTabId: newTab.id, history: [...pane.history, newTab.id] } }
            };
        });
    }, []);

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

    const updateTab = useCallback((paneId: PaneId, tabId: string, updates: Partial<Omit<Tab, 'state'>> & { state?: any }) => {
        setState(prev => {
            const pane = prev.panes[paneId];
            const tabIndex = pane.tabs.findIndex(t => t.id === tabId);
            if (tabIndex === -1) return prev;
            const updatedTabs = [...pane.tabs];
            updatedTabs[tabIndex] = { ...updatedTabs[tabIndex], ...updates, state: updates.state ? { ...updatedTabs[tabIndex].state, ...updates.state } : updatedTabs[tabIndex].state } as Tab;
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

            // Singleton Check Target
            const existingInTarget = targetPane.tabs.find(t => {
                if (t.kind !== tab.kind) return false;
                if (t.kind === 'note') return (t as NoteTab).payload.noteId === (tab as NoteTab).payload.noteId;
                if (t.kind === 'glossary_term') return (t as GlossaryEntryTab).payload.termId === (tab as GlossaryEntryTab).payload.termId;
                if (t.kind === 'starmap') return true;
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
                if (t.kind === 'glossary_term') return (t as GlossaryEntryTab).payload.termId === (tab as GlossaryEntryTab).payload.termId;
                if (t.kind === 'starmap') return true;
                return false;
            });

            let targetTabs = [...targetPane.tabs];
            let newActiveTargetId = tab.id;

            if (existingInTarget) { newActiveTargetId = existingInTarget.id; } else { targetTabs.push(tab); }

            return {
                ...prev, layout: nextLayout, focusedPaneId: targetPaneId,
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

    const closeFocusedTab = () => state.focusedPaneId;

    return {
        state, restoreState, setLayout, focusPane,
        openNoteTab, openStarMapTab, openGlossaryTab, openSearchResultsTab, openTabInPane,
        closeTab, closePane, setActiveTab, reorderTab, moveTabToPane,
        updateTabState, updateTab, moveFocus, cycleTab, closeFocusedTab, handleDragToSplit
    };
};