
# AI UI Safety Guardrails

**Directives for AI Agents modifying this codebase.**

1.  **Respect Tokens**: Never use hardcoded hex colors (e.g., `#000`) or standard Tailwind colors (e.g., `bg-gray-900`) for structural UI. Always use semantic tokens: `bg-bg`, `bg-panel`, `border-border`, `text-text`, `text-accent`.

2.  **Layout Sanctity**: 
    *   Never add a global top header bar. The Function Bar (left vertical) is the primary root navigation.
    *   Never add `overflow-auto` to the `body` or root `div`. Scroll must be contained within Panes or Panels.

3.  **Pane System Invariants**:
    *   `splitMode` is strict enum: `single`, `splitVertical`, `splitHorizontal`, `quad`. Do not invent new modes.
    *   Tabs belong to a specific `PaneId`. Never make tabs global.
    *   Max 4 panes.

4.  **Widget System Invariants**:
    *   Max 4 active widgets.
    *   Widgets must always be wrapped in the `WidgetBar` stacker.
    *   Do not hardcode widget heights in pixels (except min-heights). Use flex sharing.

5.  **Component Boundaries**:
    *   `AppShell` / `Layout` handles containers only.
    *   `App.tsx` orchestrates state.
    *   Views (`NoteEditor`, `StarMap`) must not import `AppShell`.
    *   Widgets must not modify Workspace layout directly (use events or callbacks).

6.  **Persistence**:
    *   UI State (`uiState.json`) is the source of truth for Layout, Panes, and Widgets.
    *   Always ensure new UI state properties are optional or have defaults to prevent crash on reload of old state.

7.  **Checklist**: After any UI modification, verify against `docs/ui-regression-checklist.md`.
