# Setup & Troubleshooting

## Installation

1.  **Dependencies**: Run `npm install`.
    *   Note: This project strictly uses TipTap v2. Do not upgrade `@tiptap/*` packages blindly.

2.  **Dev Server**: Run `npm run dev` to start the local server.

## Troubleshooting

### "403 Forbidden" during npm install

If you see a 403 error for `@tiptap/extension-color` or other public packages, your local configuration might be pointing to a private registry.

**Fix:**
1.  Check your current registry:
    ```bash
    npm config get registry
    ```
2.  If it is NOT `https://registry.npmjs.org/`, reset it:
    ```bash
    npm config set registry https://registry.npmjs.org/
    ```
3.  Check for a `.npmrc` file in the project root or your user home directory. If it contains auth tokens for a private registry, rename it temporarily or scope the private packages (e.g., `@myorg:registry=...`).

### "ERESOLVE" Dependency Conflicts

This usually happens if `@tiptap/pm` (ProseMirror wrapper) version drifts from the core TipTap version.
*   Ensure `package.json` pins all `@tiptap/*` packages to `2.1.13` (or the consistent version).
*   Do not use caret (`^`) ranges for TipTap to prevent accidental upgrades to v3/beta.
