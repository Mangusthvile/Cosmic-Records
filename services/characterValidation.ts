
import { Note, CharacterBlock, CharacterValidationSettings, CharacterTemplate, Workspace, CharacterData } from "../types";

export interface ValidationIssue {
    id: string;
    severity: "error" | "warning";
    message: string;
    moduleType?: string;
    blockId?: string;
    fieldPath?: string;
    action?: {
        label: string;
        type: "focusModule" | "openNote" | "openSettings";
        payload?: any;
    };
}

export interface ValidationResult {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    updatedAt: number;
}

export const validateCharacter = (
    note: Note,
    resolvedBlocks: CharacterBlock[],
    workspace: Workspace,
    settings?: CharacterValidationSettings,
    template?: CharacterTemplate
): ValidationResult => {
    const issues: ValidationIssue[] = [];
    if (!settings) return { errors: [], warnings: [], updatedAt: Date.now() };

    const strictMode = note.metadata?.characterData?.templateStrictOverride ?? template?.strictMode ?? false;
    const defaultSeverity = strictMode ? "error" : (settings.defaultSeverity || "warning");

    // 1. Missing Title
    if (!note.title || note.title.trim() === "" || note.title.startsWith("Untitled Character")) {
        issues.push({
            id: "missing-title",
            severity: strictMode ? "error" : "warning",
            message: "Character missing valid title.",
            action: { label: "Edit Title", type: "focusModule" } // Just a placeholder, UI will focus header
        });
    }

    // 2. Identity Fields
    if (settings.identityRules?.enabled) {
        const requiredFields = template?.validation?.requiredIdentityFields || settings.identityRules.requiredFields || [];
        const identityBlock = resolvedBlocks.find(b => b.type === 'identity');
        
        if (!identityBlock) {
            issues.push({
                id: "missing-identity-module",
                severity: defaultSeverity,
                message: "Identity module is missing.",
                moduleType: 'identity'
            });
        } else {
            const fields = identityBlock.payload.fields || [];
            requiredFields.forEach(req => {
                const found = fields.find((f: any) => f.key.toLowerCase() === req.toLowerCase() && f.value.trim().length > 0);
                if (!found) {
                    issues.push({
                        id: `missing-field-${req}`,
                        severity: defaultSeverity,
                        message: `Missing identity field: ${req}`,
                        moduleType: 'identity',
                        blockId: identityBlock.blockId,
                        fieldPath: req,
                        action: { label: "Go to Field", type: "focusModule", payload: identityBlock.blockId }
                    });
                }
            });
        }
    }

    // 3. Stat Ranges
    if (settings.statRanges?.enabled) {
        const statsBlock = resolvedBlocks.find(b => b.type === 'stats');
        if (statsBlock) {
            const stats = statsBlock.payload.stats || [];
            const defaultRange = settings.statRanges.defaults;
            const perStat = { ...settings.statRanges.perStat, ...template?.validation?.statRanges?.perStat };

            stats.forEach((stat: any) => {
                const val = stat.value;
                if (typeof val !== 'number' || isNaN(val)) {
                    issues.push({
                        id: `invalid-stat-${stat.name}`,
                        severity: "warning",
                        message: `Stat "${stat.name}" is not a number.`,
                        moduleType: 'stats',
                        blockId: statsBlock.blockId,
                        action: { label: "Fix Stat", type: "focusModule", payload: statsBlock.blockId }
                    });
                } else {
                    const range = perStat[stat.name] || defaultRange;
                    if (val < range.min || val > range.max) {
                        issues.push({
                            id: `range-stat-${stat.name}`,
                            severity: defaultSeverity,
                            message: `Stat "${stat.name}" (${val}) is out of range (${range.min}-${range.max}).`,
                            moduleType: 'stats',
                            blockId: statsBlock.blockId,
                            action: { label: "Fix Stat", type: "focusModule", payload: statsBlock.blockId }
                        });
                    }
                }
            });
        }
    }

    // 4. Unresolved Place Links
    if (settings.unresolvedPlaceLinks?.enabled) {
        const locBlock = resolvedBlocks.find(b => b.type === 'locations');
        if (locBlock) {
            const checkPlace = (placeId: string | null, label: string) => {
                if (!placeId) return;
                const placeNote = workspace.notes[placeId];
                if (!placeNote) {
                    issues.push({
                        id: `missing-place-${placeId}`,
                        severity: "warning",
                        message: `${label} links to a missing note.`,
                        moduleType: 'locations',
                        blockId: locBlock.blockId,
                        action: { label: "Go to Locations", type: "focusModule", payload: locBlock.blockId }
                    });
                } else if (placeNote.unresolved) {
                    const severity = (strictMode && template?.validation?.requireNonUnresolvedPlaces) ? "error" : "warning";
                    issues.push({
                        id: `unresolved-place-${placeId}`,
                        severity: severity,
                        message: `${label} links to an Unresolved note: "${placeNote.title}"`,
                        moduleType: 'locations',
                        blockId: locBlock.blockId,
                        action: { label: "Open Note", type: "openNote", payload: placeId }
                    });
                }
            };

            checkPlace(locBlock.payload.originPlaceId, "Origin");
            checkPlace(locBlock.payload.currentPlaceId, "Current Location");
            if (locBlock.payload.otherPlaces) {
                locBlock.payload.otherPlaces.forEach((p: any) => checkPlace(p.placeId, `Location "${p.label || 'Unknown'}"`));
            }
        }
    }

    // 5. Conflicting Paths (Simple Tag Check)
    if (settings.conflictingPaths?.enabled && settings.conflictingPaths.groups.length > 0) {
        // Collect all tags from Identity (affiliations, roleOrClass treated as tags if comma sep?) 
        // or dedicated "tags" module.
        // Let's assume standard Tags module + Identity Class/Role
        const tags = new Set<string>();
        
        const tagsBlock = resolvedBlocks.find(b => b.type === 'tags');
        if (tagsBlock && tagsBlock.payload.tags) {
            tagsBlock.payload.tags.forEach((t: string) => tags.add(t.toLowerCase()));
        }

        const identityBlock = resolvedBlocks.find(b => b.type === 'identity');
        if (identityBlock) {
            // Treat affiliations as tags
            if (identityBlock.payload.affiliations) {
                identityBlock.payload.affiliations.forEach((t: string) => tags.add(t.toLowerCase()));
            }
            if (identityBlock.payload.roleOrClass) {
                tags.add(identityBlock.payload.roleOrClass.toLowerCase());
            }
        }

        settings.conflictingPaths.groups.forEach(group => {
            const conflicts = group.keys.filter(k => tags.has(k.toLowerCase()));
            if (conflicts.length > 1) {
                issues.push({
                    id: `conflict-${group.id}`,
                    severity: defaultSeverity,
                    message: `Conflicting selections in "${group.label}": ${conflicts.join(', ')}`,
                    moduleType: 'tags',
                    action: { label: "Check Tags", type: "focusModule", payload: tagsBlock?.blockId }
                });
            }
        });
    }

    return {
        errors: issues.filter(i => i.severity === 'error'),
        warnings: issues.filter(i => i.severity === 'warning'),
        updatedAt: Date.now()
    };
};
