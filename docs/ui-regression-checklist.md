
# UI Regression Checklist

**Stop. Before merging or committing changes, verify these items.**
If any item fails, revert and fix immediately. Do not build new features on broken UI.

## 1. Dark Cosmos Baseline
- [ ] **Theme Integrity**: App is strictly dark mode. No white backgrounds or default browser inputs visible.
- [ ] **Tokens**: Panels use `bg-panel`, `bg-panel2`, `bg-deep-space`. Borders use `border-border`.
- [ ] **Hover**: Hover states are subtle (`hover:bg-panel2` or `hover:text-accent`). No jarring color shifts.
- [ ] **Focus**: Tabbing through elements shows a visible `ring-focus` or consistent outline.
- [ ] **Typography**: Font is Inter/Sans. Code is JetBrains Mono. Sizing is consistent (text-sm for body, text-xs for UI).

## 2. Layout Shell Integrity
- [ ] **Function Bar**: Fixed width (approx 48px). Icons centered. Selection state visible.
- [ ] **Navigation Bar**: Resizable via drag handle. Collapsible via button.
- [ ] **Widget Bar**: Resizable via drag handle. Collapsible via button.
- [ ] **Reopen Buttons**: When bars are collapsed, floating buttons appear to reopen them.
- [ ] **No Page Scroll**: The main window body never scrolls. Only internal panels scroll.
- [ ] **Persistence**: Reload the app. Widths and collapse states restore exactly.

## 3. Pane Manager
- [ ] **Split Modes**: Verify Single, Vertical, Horizontal, and Quad splits.
- [ ] **Max Panes**: Never more than 4 panes.
- [ ] **Focus Indicator**: The active pane has a distinct border or visual indicator.
- [ ] **Creation**: New notes always open in the *focused* pane.

## 4. Tabs
- [ ] **Per Pane**: Each pane has its own independent tab strip.
- [ ] **Reorder**: Dragging a tab sideways reorders it.
- [ ] **Move**: Dragging a tab to another pane moves it (no duplication).
- [ ] **Closure**: Closing the active tab selects the nearest neighbor. Closing the last tab shows Empty Pane state.
- [ ] **Persistence**: Reload app. Tabs restore to correct panes and order.

## 5. View Registry
- [ ] **Rendering**: Note, Star Map, Glossary, and Search views render correctly.
- [ ] **Missing**: If a note ID is missing, the tab shows a "Missing" placeholder, not a crash.
- [ ] **State**: Scroll position or view-specific state (e.g., Map zoom) persists when switching tabs.

## 6. Widget Bar
- [ ] **Picker**: Widget picker at top toggles widgets on/off.
- [ ] **Stacking**: Up to 4 widgets stack vertically.
- [ ] **Sizing**: 1 widget fills height. Multiple widgets share height.
- [ ] **Scroll**: Each widget body scrolls independently.
- [ ] **Context**: Outline and Backlinks update to match the *active note* of the *focused pane*.

## 7. Hotkeys
- [ ] **New Note (Mod+N)**: Opens in focused pane.
- [ ] **Close Tab (Mod+W)**: Closes active tab of focused pane.
- [ ] **Next/Prev Tab**: Cycles only within focused pane.
- [ ] **Splits**: Triggering split commands works and preserves existing tabs.
