
import { Workspace, Note, MigrationPlan, MigrationAction, NoteType, RecordKind } from '../types';
import { vaultService, MIGRATION_DIR, MIGRATION_STATE_FILE } from './vaultService';
import { join } from './path';
import { migrateNoteToModular } from './dataMigration';

// Sanitization for filenames
const sanitizeTitle = (title: string): string => {
    let sanitized = title.trim().replace(/[\/\\:*?"<>|]/g, '_'); // Replace illegal chars
    sanitized = sanitized.replace(/\s+/g, ' '); // Collapse whitespace
    if (sanitized.length > 80) sanitized = sanitized.substring(0, 80); // Max length
    if (!sanitized) sanitized = 'Untitled';
    return sanitized;
};

// Canonical Filename Format: Title__ID.json
const getCanonicalFileName = (note: Note): string => {
    const safeTitle = sanitizeTitle(note.title);
    const shortId = note.id.split('-')[0]; // Use first segment of UUID for brevity but reasonable uniqueness
    return `${safeTitle}__${shortId}.json`;
};

export const analyzeMigration = async (workspace: Workspace): Promise<MigrationPlan> => {
    const actions: MigrationAction[] = [];
    const notes = Object.values(workspace.notes);
    
    // Map to track destination paths to detect collisions
    const pathMap = new Map<string, string>(); // path -> noteId

    for (const note of notes) {
        // 1. Determine New Type
        let newType: NoteType = note.type;
        let newRecordKind: RecordKind | undefined = note.recordKind;
        let typeChanged = false;

        const originalType = note.type as string; // Allow legacy check

        if (['Character', 'Item', 'Event', 'Lore'].includes(originalType)) {
            newType = 'modular';
            newRecordKind = originalType.toLowerCase() as RecordKind;
            typeChanged = true;
        } else if (originalType === 'Place') {
            newType = 'place';
            newRecordKind = 'place';
            typeChanged = true;
        } else if (originalType === 'Canvas') {
            newType = 'canvas';
            // recordKind undefined for canvas? Or custom?
        } else if (originalType === 'General' || !originalType) {
            newType = 'general';
        }

        // Add Type Conversion Action if needed
        if (typeChanged) {
            actions.push({
                kind: 'convertNoteType',
                noteId: note.id,
                oldType: originalType,
                newType: newType,
                changesSummary: `Legacy ${originalType} -> ${newType}`
            });
        }

        // 2. Determine New Filename/Path
        const fileInfo = workspace.indexes.note_files?.[note.id];
        const currentFileName = fileInfo?.fileName;
        const currentFolderPath = fileInfo?.folderPath || '';
        
        if (!currentFileName) {
            // If file missing from index, skip rename logic (safety)
            continue;
        }

        const canonicalName = getCanonicalFileName(note);
        let targetPath = join(currentFolderPath, canonicalName);

        // Check collision in plan
        if (pathMap.has(targetPath)) {
            // Collision detected! Append dup suffix
            const dupId = pathMap.get(targetPath);
            if (dupId !== note.id) {
                targetPath = join(currentFolderPath, `${sanitizeTitle(note.title)}__${note.id.split('-')[0]}__dup.json`);
                actions.push({
                    kind: 'resolveConflict',
                    noteId: note.id,
                    reason: `Path collision with ${dupId}`
                });
            }
        }
        pathMap.set(targetPath, note.id);

        if (currentFileName !== canonicalName) {
            actions.push({
                kind: 'renameFile',
                noteId: note.id,
                fromPath: join(currentFolderPath, currentFileName),
                toPath: targetPath,
                reason: 'Standardize naming format'
            });
        }
    }

    return {
        createdAt: new Date().toISOString(),
        vaultRootId: workspace.workspace_id,
        actions
    };
};

export const applyMigration = async (plan: MigrationPlan, workspace: Workspace): Promise<{ success: boolean; error?: string }> => {
    const adapter = vaultService.adapter;
    if (!adapter) return { success: false, error: "Vault not connected" };

    try {
        await adapter.mkdir(MIGRATION_DIR, { recursive: true });
        
        // Save Plan
        await adapter.writeFile(
            join(MIGRATION_DIR, `plan_${Date.now()}.json`), 
            JSON.stringify(plan, null, 2)
        );

        for (const action of plan.actions) {
            // 1. Type Conversion
            if (action.kind === 'convertNoteType' && action.noteId) {
                const note = workspace.notes[action.noteId];
                if (note) {
                    note.type = action.newType as NoteType;
                    // Run logic migration to reshape data if needed
                    const migrated = migrateNoteToModular(note);
                    
                    // Specific fix for Place if migrateNoteToModular defaults to 'modular'
                    if (action.newType === 'place') {
                        migrated.type = 'place';
                        migrated.recordKind = 'place';
                        // Ensure PlaceData init
                        if (!migrated.placeData) {
                            migrated.placeData = { parentPlaceId: null };
                            migrated.eras = { order: [], byId: {} };
                        }
                    }
                    
                    workspace.notes[action.noteId] = migrated;
                    // Persist immediately (in place) before rename
                    vaultService.onNoteChange(migrated);
                }
            }

            // 2. Rename File
            if (action.kind === 'renameFile' && action.fromPath && action.toPath) {
                // Safety: Check if source exists
                if (await adapter.exists(action.fromPath)) {
                    // Backup
                    const backupPath = action.fromPath + '.bak';
                    if (await adapter.exists(backupPath)) await adapter.delete(backupPath);
                    
                    // Simple Copy to Backup (manual copy implementation or move then write?)
                    // Safest: read -> write backup -> move original to new
                    // Adapter move is rename.
                    // Let's rely on move.
                    
                    // But first, we want a backup. 
                    const content = await adapter.readFile(action.fromPath);
                    await adapter.writeFile(backupPath, content);

                    // Perform Rename
                    await adapter.move(action.fromPath, action.toPath);
                    
                    // Update Index in memory
                    if (action.noteId && workspace.indexes.note_files) {
                        const info = workspace.indexes.note_files[action.noteId];
                        if (info) {
                            // Extract new filename from path
                            const parts = action.toPath.split('/');
                            info.fileName = parts[parts.length - 1];
                            // folderPath remains same for pure rename
                        }
                    }
                }
            }
        }

        // Save Migration State
        const state = {
            schemaVersion: 1,
            lastRunAt: new Date().toISOString(),
            lastResult: 'success',
            appliedPlanHash: 'TODO_HASH' 
        };
        await adapter.writeFile(join(MIGRATION_DIR, MIGRATION_STATE_FILE), JSON.stringify(state, null, 2));

        return { success: true };

    } catch (e: any) {
        console.error("Migration Failed", e);
        return { success: false, error: e.message };
    }
};
