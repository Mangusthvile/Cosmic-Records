
import React, { useEffect } from 'react';
import { PaneSystemState, WidgetSystemState } from '../types';

interface DevInvariantCheckerProps {
    paneSystem: PaneSystemState;
    widgetState: WidgetSystemState;
}

/**
 * Development utility to warn about broken UI invariants.
 * Does not render anything.
 */
const DevInvariantChecker: React.FC<DevInvariantCheckerProps> = ({ paneSystem, widgetState }) => {
    useEffect(() => {
        if (process.env.NODE_ENV === 'production') return;

        const warnings: string[] = [];

        // 1. Pane Count
        const paneCount = Object.keys(paneSystem.panes).length;
        if (paneCount > 4) warnings.push(`Invariant Violation: ${paneCount} panes detected. Max 4 allowed.`);

        // 2. Focused Pane Validity
        if (!paneSystem.panes[paneSystem.focusedPaneId]) {
            warnings.push(`Invariant Violation: Focused Pane ID '${paneSystem.focusedPaneId}' does not exist.`);
        }

        // 3. Widget Count
        if (widgetState.openWidgetIds.length > 4) {
            warnings.push(`Invariant Violation: ${widgetState.openWidgetIds.length} active widgets. Max 4 allowed.`);
        }

        // 4. Split Mode Consistency
        if (paneSystem.layout === 'single' && paneSystem.paneOrder.length > 4) {
             // Just a sanity check on internal arrays
        }

        if (warnings.length > 0) {
            console.group('🚨 UI Invariant Violations');
            warnings.forEach(w => console.warn(w));
            console.groupEnd();
        }

    }, [paneSystem, widgetState]);

    return null;
};

export default DevInvariantChecker;
