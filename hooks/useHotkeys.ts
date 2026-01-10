
import { useEffect } from 'react';
import { Workspace, NavigationState, WidgetSystemState, PaneId } from '../types';

export const useHotkeys = (
    workspace: Workspace,
    paneSystem: any, // Return type of usePaneSystem
    navState: NavigationState,
    onNavChange: (partial: Partial<NavigationState>) => void,
    widgetState: WidgetSystemState,
    onWidgetChange: (state: WidgetSystemState) => void,
    actions: {
        saveNote: () => void;
        findInNote: () => void;
        newNote: () => void;
    }
) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Helper to match key combos
            const isMod = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;
            const isAlt = e.altKey;
            const key = e.key.toLowerCase();

            // Ignore inputs for dangerous commands, but allow safe ones
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            // --- SAFE COMMANDS (Allowed in inputs) ---
            
            // Save: Mod+S
            if (isMod && key === 's') {
                e.preventDefault();
                actions.saveNote();
                return;
            }

            // Find: Mod+F
            if (isMod && key === 'f' && !isShift) {
                e.preventDefault();
                actions.findInNote();
                return;
            }

            // --- CONTEXT SENSITIVE COMMANDS (Blocked in inputs) ---
            if (isInput) return;

            // New Note: Mod+N
            if (isMod && key === 'n') {
                e.preventDefault();
                actions.newNote();
                return;
            }

            // Close Tab: Mod+W (Attempt preventDefault, browser allowing)
            if (isMod && key === 'w') {
                e.preventDefault();
                const focusedPane = paneSystem.state.focusedPaneId;
                const activeTab = paneSystem.state.panes[focusedPane].activeTabId;
                if (activeTab) {
                    paneSystem.closeTab(focusedPane, activeTab);
                }
                return;
            }

            // Next Tab: Mod+Tab (or Ctrl+Tab) - often blocked by browser, try Alt+Tab or similar if needed
            // Implementing Mod+Tab logic, though browser usually traps it.
            // Using Option+Tab (Alt+Tab) as alternative for web?
            // Let's stick to spec but add Alt+Right/Left for tab cycling as a backup for accessibility
            if (isMod && key === 'tab') {
                e.preventDefault();
                paneSystem.cycleTab(isShift ? 'prev' : 'next');
                return;
            }

            // Pane Navigation: Alt+Arrows
            if (isAlt && !isShift && !isMod) {
                if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                    e.preventDefault();
                    paneSystem.moveFocus(key.replace('arrow', '') as any);
                    return;
                }
            }

            // Split Commands: Mod+Alt+Key
            if (isMod && isAlt) {
                if (key === 'v') { e.preventDefault(); paneSystem.setLayout('splitVertical'); return; }
                if (key === 'h') { e.preventDefault(); paneSystem.setLayout('splitHorizontal'); return; }
                if (key === 'g') { e.preventDefault(); paneSystem.setLayout('quad'); return; } // Grid/Quad
                if (key === '1') { e.preventDefault(); paneSystem.setLayout('single'); return; }
            }

            // Toggle Bars: Mod+B / Mod+Shift+B
            if (isMod && key === 'b') {
                e.preventDefault();
                if (isShift) {
                    // Toggle Widget Bar (Helper)
                    // We need a way to toggle the layout state which lives in App/Layout
                    // This requires a callback or state access not fully exposed yet?
                    // Assuming we can trigger a custom event or callback passed in.
                    // For now, these are Layout props. We need to pass setters or dispatch events.
                    window.dispatchEvent(new CustomEvent('app-command', { detail: { command: 'toggle-widget-bar' } }));
                } else {
                    // Toggle Nav Bar
                    window.dispatchEvent(new CustomEvent('app-command', { detail: { command: 'toggle-nav-bar' } }));
                }
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [workspace, paneSystem, navState, widgetState, actions]);
};
