
import { CharacterBlock, CharacterForm, CharacterData } from '../types';

/**
 * Resolves the final view of blocks for a given form.
 * Merges Base Blocks with Form Overrides and appends Form Local Blocks.
 */
export const resolveBlocks = (
    baseBlocks: CharacterBlock[],
    form: CharacterForm | undefined
): CharacterBlock[] => {
    if (!form) return baseBlocks; // Fallback

    const resolved: CharacterBlock[] = [];

    // 1. Process Base Blocks
    for (const base of baseBlocks) {
        const override = form.overrides[base.blockId];

        // If deleted in override, skip
        if (override && override.deleted) {
            continue;
        }

        // Merge override props if present
        if (override) {
            resolved.push({
                ...base,
                title: override.title !== undefined ? override.title : base.title,
                collapsed: override.collapsed !== undefined ? override.collapsed : base.collapsed,
                payload: override.payload !== undefined ? override.payload : base.payload
            });
        } else {
            // No override, use base
            resolved.push(base);
        }
    }

    // 2. Append Local Blocks (Modules specific to this form)
    if (form.localBlocks && form.localBlocks.length > 0) {
        resolved.push(...form.localBlocks);
    }

    return resolved;
};

/**
 * Helper to ensure forms structure is valid during migration or initialization
 */
export const ensureFormsStructure = (data: CharacterData): CharacterData => {
    const safeData = JSON.parse(JSON.stringify(data)); // Deep clone to be safe

    if (!safeData.forms || Array.isArray(safeData.forms)) {
        // Migration from array to object structure or init
        const oldForms = Array.isArray(safeData.forms) ? safeData.forms : [];
        
        safeData.forms = {
            schemaVersion: 1,
            activeFormId: safeData.activeFormId || 'base',
            order: [],
            items: {}
        };

        // Ensure Base form exists
        if (!oldForms.some((f: any) => f.formId === 'base')) {
            safeData.forms.items['base'] = {
                formId: 'base',
                name: 'Base',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                overrides: {},
                localBlocks: []
            };
            safeData.forms.order.push('base');
        }

        // Migrate existing array items
        oldForms.forEach((f: any) => {
            if (!safeData.forms.items[f.formId]) {
                safeData.forms.items[f.formId] = {
                    ...f,
                    overrides: f.overrides || {},
                    localBlocks: f.localBlocks || []
                };
                safeData.forms.order.push(f.formId);
            }
        });
    }

    if (!safeData.snapshots || Array.isArray(safeData.snapshots)) {
        const oldSnapshots = Array.isArray(safeData.snapshots) ? safeData.snapshots : [];
        safeData.snapshots = {
            schemaVersion: 1,
            activeSnapshotId: null,
            order: [],
            items: {}
        };
        oldSnapshots.forEach((s: any) => {
            safeData.snapshots.items[s.snapshotId] = s;
            safeData.snapshots.order.push(s.snapshotId);
        });
    }

    return safeData;
};
