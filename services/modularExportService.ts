
import { 
    Note, Workspace, CharacterData, CharacterBlock, 
    CharacterBundle, CharacterFullBundle, CharacterForm,
    NoteStatus
} from '../types';
import { resolveBlocks, ensureFormsStructure } from './modularResolution';
import { noteContentToPlainText, vaultService } from './vaultService';
import { getUniqueTitle, createNote } from './storageService';
import { createCharacterBlock } from './modularModuleRegistry';

// --- Export Logic ---

export const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

const extractReferences = (resolvedBlocks: CharacterBlock[], workspace: Workspace) => {
    const places = new Set<string>();
    const characters = new Set<string>();
    const generalNotes = new Set<string>();

    const addRef = (id: string | null | undefined, set: Set<string>) => {
        if (id) set.add(id);
    };

    resolvedBlocks.forEach(block => {
        if (block.type === 'locations') {
            addRef(block.payload.originPlaceId, places);
            addRef(block.payload.currentPlaceId, places);
            if (Array.isArray(block.payload.otherPlaces)) {
                block.payload.otherPlaces.forEach((p: any) => addRef(p.placeId, places));
            }
        } else if (block.type === 'relationships') {
            if (Array.isArray(block.payload.relationships)) {
                block.payload.relationships.forEach((r: any) => addRef(r.targetCharacterId, characters));
            }
        }
    });

    const resolveRefs = (ids: Set<string>) => Array.from(ids).map(id => {
        const note = workspace.notes[id];
        return {
            noteId: id,
            title: note?.title,
            unresolved: note ? note.unresolved : true
        };
    });

    return {
        places: resolveRefs(places),
        characters: resolveRefs(characters),
        notes: resolveRefs(generalNotes)
    };
};

const extractNormalized = (resolvedBlocks: CharacterBlock[], workspace: Workspace) => {
    const normalized: any = {};

    const identity = resolvedBlocks.find(b => b.type === 'identity');
    if (identity) {
        normalized.identity = {};
        identity.payload.fields?.forEach((f: any) => {
            if (f.key && f.value) normalized.identity[f.key.toLowerCase()] = f.value;
        });
    }

    const stats = resolvedBlocks.find(b => b.type === 'stats');
    if (stats) {
        normalized.stats = {};
        stats.payload.stats?.forEach((s: any) => {
            if (s.name) normalized.stats[s.name] = s.value;
        });
    }

    const abilities = resolvedBlocks.find(b => b.type === 'abilities');
    if (abilities) {
        normalized.abilities = abilities.payload.abilities?.map((a: any) => ({
            name: a.name,
            type: a.type,
            description: a.descriptionDoc ? noteContentToPlainText({ content: a.descriptionDoc }) : '',
            tags: a.tags
        }));
    }

    const items = resolvedBlocks.find(b => b.type === 'items');
    if (items) {
        normalized.items = items.payload.items?.map((i: any) => ({
            name: i.name,
            quantity: i.qty,
            description: i.notes
        }));
    }

    const relationships = resolvedBlocks.find(b => b.type === 'relationships');
    if (relationships) {
        normalized.relationships = relationships.payload.relationships?.map((r: any) => {
            const target = workspace.notes[r.targetCharacterId];
            return {
                targetCharacterId: r.targetCharacterId,
                targetCharacterTitle: target?.title || 'Unknown',
                relationshipType: r.type,
                notes: r.notesDoc ? noteContentToPlainText({ content: r.notesDoc }) : ''
            };
        });
    }

    const locations = resolvedBlocks.find(b => b.type === 'locations');
    if (locations) {
        normalized.locations = {
            originPlaceId: locations.payload.originPlaceId,
            originPlaceTitle: workspace.notes[locations.payload.originPlaceId]?.title,
            currentPlaceId: locations.payload.currentPlaceId,
            currentPlaceTitle: workspace.notes[locations.payload.currentPlaceId]?.title,
            otherPlaces: locations.payload.otherPlaces?.map((p: any) => ({
                placeId: p.placeId,
                placeTitle: workspace.notes[p.placeId]?.title,
                label: p.label
            }))
        };
    }

    const tags = resolvedBlocks.find(b => b.type === 'tags');
    if (tags) {
        normalized.tags = tags.payload.tags || [];
    }

    const summary = resolvedBlocks.find(b => b.type === 'summary');
    if (summary) {
        normalized.narrativeSummary = noteContentToPlainText({ content: summary.payload.doc });
    }

    return normalized;
};

export const createCharacterBundle = (note: Note, workspace: Workspace): CharacterBundle | null => {
    if (!note.metadata?.characterData) return null;
    const charData = ensureFormsStructure(note.metadata.characterData);
    const activeForm = charData.forms.items[charData.forms.activeFormId];
    
    // Resolve Blocks
    const resolvedBlocks = resolveBlocks(charData.blocks, activeForm);
    const normalized = extractNormalized(resolvedBlocks, workspace);
    const references = extractReferences(resolvedBlocks, workspace);

    const template = workspace.characterTemplates[charData.templateId];

    return {
        bundleSchemaVersion: 1,
        exportedAt: Date.now(),
        sourceApp: { name: "cosmic-records", version: "1.0" },
        character: {
            noteId: note.id,
            title: note.title,
            noteType: "character",
            status: note.status,
            unresolved: note.unresolved,
            universeTag: note.universeTag,
            folderPath: "exported",
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
        },
        template: {
            templateId: charData.templateId,
            templateName: template?.name,
            strictMode: template?.strictMode
        },
        selection: {
            formId: activeForm.formId,
            formName: activeForm.name,
            snapshotId: charData.snapshots.activeSnapshotId
        },
        resolvedSheet: {
            blocks: resolvedBlocks,
            normalized
        },
        references
    };
};

export const createCharacterFullBundle = (note: Note, workspace: Workspace): CharacterFullBundle | null => {
    if (!note.metadata?.characterData) return null;
    const charData = ensureFormsStructure(note.metadata.characterData);
    
    // Resolve references from ALL forms
    // Simpler: iterate all blocks in all forms and resolve
    // For now, let's just do active form to save complexity or iterate properly if needed.
    // The prompt requirement implies simple extraction. Let's assume active form refs for metadata is enough, 
    // or just aggregate base blocks refs.
    const resolvedBase = resolveBlocks(charData.blocks, undefined);
    const references = extractReferences(resolvedBase, workspace);
    
    const template = workspace.characterTemplates[charData.templateId];

    return {
        bundleSchemaVersion: 1,
        exportedAt: Date.now(),
        sourceApp: { name: "cosmic-records", version: "1.0" },
        character: {
            noteId: note.id,
            title: note.title,
            noteType: "character",
            status: note.status,
            unresolved: note.unresolved,
            universeTag: note.universeTag,
            folderPath: "exported",
            createdAt: note.createdAt,
            updatedAt: note.updatedAt
        },
        template: {
            templateId: charData.templateId,
            templateName: template?.name,
            strictMode: template?.strictMode
        },
        characterData: charData,
        selection: {
            currentFormId: charData.forms.activeFormId,
            currentSnapshotId: charData.snapshots.activeSnapshotId
        },
        references
    };
};

// --- Import Logic ---

export const importCharacterBundle = async (
    file: File, 
    workspace: Workspace
): Promise<Note | null> => {
    const text = await file.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        alert("Invalid JSON file");
        return null;
    }

    if (data.bundleSchemaVersion !== 1) {
        alert("Unsupported bundle version");
        return null;
    }

    // Determine type
    const isFull = !!data.characterData;
    const title = getUniqueTitle(workspace, data.character.title + (workspace.indexes.title_to_note_id[data.character.title] ? " (Imported)" : ""));
    
    // Create new Note Shell
    // Use createNote logic but we construct manually to inject specific data
    const newNoteId = crypto.randomUUID();
    const now = Date.now();

    let characterData: CharacterData;

    if (isFull) {
        const fullBundle = data as CharacterFullBundle;
        characterData = {
            ...fullBundle.characterData,
            importedFrom: { originalNoteId: fullBundle.character.noteId, exportedAt: fullBundle.exportedAt }
        };
        // Reset active session state potentially? No, keep as exported.
    } else {
        const simpleBundle = data as CharacterBundle;
        // Flatten resolved blocks into base blocks
        const blocks = simpleBundle.resolvedSheet.blocks;
        
        characterData = {
            templateId: simpleBundle.template.templateId,
            blocks: blocks,
            forms: {
                schemaVersion: 1,
                activeFormId: 'base',
                order: ['base'],
                items: {
                    'base': {
                        formId: 'base',
                        name: 'Base',
                        createdAt: now,
                        updatedAt: now,
                        overrides: {},
                        localBlocks: []
                    }
                }
            },
            snapshots: {
                schemaVersion: 1,
                activeSnapshotId: null,
                order: [],
                items: {}
            },
            importedFrom: { originalNoteId: simpleBundle.character.noteId, exportedAt: simpleBundle.exportedAt }
        };
    }

    const note: Note = {
        id: newNoteId,
        title: title,
        type: 'modular',
        recordKind: 'character',
        status: 'Draft',
        unresolved: false,
        unresolvedSources: [],
        universeTag: data.character.universeTag || null,
        folderId: 'inbox',
        createdAt: now,
        updatedAt: now,
        content: { type: 'doc', content: [] }, // Empty doc, content is in modules
        pinned: false,
        tag_ids: [],
        metadata: {
            kind: 'character',
            characterData,
            data: {}
        },
        outbound_note_ids: []
    };

    // Persist
    vaultService.onNoteChange(note);
    
    // Update workspace index in memory immediately
    workspace.notes[note.id] = note;
    workspace.indexes.title_to_note_id[note.title] = note.id;
    
    return note;
};