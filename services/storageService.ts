
import { 
  Workspace, Note, NoteType, NoteStatus, 
  ID, UserPreferences, GlossaryTerm, PendingTerm, Folder, Collection,
  NotificationLogItem,
  CollectionsData,
  MapData
} from "../types";
import { parseWikiLinks, extractLinkTitles, extractOutboundLinks } from "./linkService";
import { vaultService, noteContentToPlainText } from "./vaultService";
import { extractCandidateTerms, scanTextForGlossaryTerms } from "./termDetection";

export const normalizeKey = (str: string): string => {
    return str.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s-]/g, ''); // Trim, lower, collapse space, simple punctuation remove
};

const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const createDefaultPreferences = (): UserPreferences => ({
  ai: { proactive: true, allow_auto_edits: false, remember_preferences: true },
  tts: { mode: "selected_text_only" },
  ui: { gray_out_outdated_titles: true, show_badges_in_search: true, show_unresolved_prominently: true },
  widgets: { autoOpenRecommended: true }
});

export const logNotification = (
    workspace: Workspace, 
    type: NotificationLogItem['type'], 
    message: string, 
    relatedNoteId?: string
) => {
    const logItem: NotificationLogItem = {
        id: generateId(),
        timestamp: Date.now(),
        type,
        message,
        relatedNoteId,
        read: false
    };
    workspace.notificationLog = [logItem, ...workspace.notificationLog].slice(0, 100); 
};

export const getUniqueTitle = (workspace: Workspace, baseTitle: string, excludeId?: string): string => {
    let title = baseTitle;
    let counter = 2;
    const notes = Object.values(workspace.notes);
    
    while (notes.some(n => n.title.toLowerCase() === title.toLowerCase() && n.id !== excludeId)) {
        title = `${baseTitle} ${counter}`;
        counter++;
    }
    return title;
};

// --- Unresolved Logic ---

export const ensureUnresolvedNote = (workspace: Workspace, title: string, sourceNoteId: string): ID => {
    if (workspace.indexes.title_to_note_id[title]) {
        const existingId = workspace.indexes.title_to_note_id[title];
        const note = workspace.notes[existingId];
        if (note.unresolvedSources && !note.unresolvedSources.includes(sourceNoteId)) {
            note.unresolvedSources.push(sourceNoteId);
        } else if (!note.unresolvedSources) {
            note.unresolvedSources = [sourceNoteId];
        }
        return existingId;
    }

    const id = generateId();
    const now = Date.now();
    
    const initialContent = {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
            { type: 'paragraph', content: [{ type: 'text', text: `Unresolved link created from [[${workspace.notes[sourceNoteId]?.title || 'Unknown source'}]].` }] }
        ]
    };

    const note: Note = {
        id,
        title,
        type: "General",
        status: "Draft",
        unresolved: true,
        unresolvedSources: [sourceNoteId],
        universeTag: null,
        folderId: 'unresolved',
        createdAt: now,
        updatedAt: now,
        content: initialContent,
        pinned: false,
        tag_ids: [],
        metadata: { kind: 'general', data: {} }
    };

    workspace.notes[id] = note;
    workspace.indexes.title_to_note_id[title] = id;
    workspace.indexes.unresolved_note_ids.push(id);
    
    vaultService.onNoteChange(note);
    logNotification(workspace, 'warning', `Unresolved note created: ${title}`, id);

    return id;
};

const scanContentAndCreateUnresolved = (workspace: Workspace, noteId: string) => {
    const note = workspace.notes[noteId];
    if (!note) return; 
    const text = noteContentToPlainText(note);
    const linkedTitles = extractLinkTitles(text);
    linkedTitles.forEach(title => {
        ensureUnresolvedNote(workspace, title, noteId);
    });
};

const handleRename = (workspace: Workspace, note: Note, oldTitle: string) => {
    if (workspace.indexes.title_to_note_id[oldTitle] === note.id) {
        delete workspace.indexes.title_to_note_id[oldTitle];
    }
    workspace.indexes.title_to_note_id[note.title] = note.id;
    logNotification(workspace, 'success', `Renamed: "${oldTitle}" → "${note.title}"`, note.id);
};

const updateLinkGraph = (workspace: Workspace, note: Note) => {
    const newOutbound = extractOutboundLinks(note.content, (t) => workspace.indexes.title_to_note_id[t]);
    const oldOutbound = note.outbound_note_ids || [];
    
    oldOutbound.forEach(targetId => {
        if (workspace.indexes.backlinks[targetId]) {
            workspace.indexes.backlinks[targetId] = workspace.indexes.backlinks[targetId].filter(id => id !== note.id);
        }
    });

    newOutbound.forEach(targetId => {
        if (!workspace.indexes.backlinks[targetId]) workspace.indexes.backlinks[targetId] = [];
        if (!workspace.indexes.backlinks[targetId].includes(note.id)) {
            workspace.indexes.backlinks[targetId].push(note.id);
        }
    });

    note.outbound_note_ids = newOutbound;
};

// --- Note CRUD ---

interface CreateNoteOptions {
    title?: string;
    type?: string;
    status?: NoteStatus;
    folderId?: string;
    universeTag?: string | null;
    method?: 'blank' | 'ai';
}

export const createNote = (
    workspace: Workspace, 
    options: CreateNoteOptions = {}
): Note => {
    const id = generateId();
    const baseTitle = options.title || "New Record";
    const title = getUniqueTitle(workspace, baseTitle);
    const now = Date.now();

    const note: Note = {
        id,
        title,
        type: options.type || "General",
        status: options.status || "Draft",
        unresolved: false,
        unresolvedSources: [],
        universeTag: options.universeTag || null,
        folderId: options.folderId || 'inbox',
        createdAt: now,
        updatedAt: now,
        content: { type: 'doc', content: [] },
        pinned: false,
        tag_ids: [],
        metadata: { kind: 'general', data: {} },
        outbound_note_ids: []
    };

    if (options.method === 'ai') {
        note.aiInterview = {
            isActive: true,
            step: 'start',
            transcript: []
        };
        note.title = getUniqueTitle(workspace, `${baseTitle} (AI)`); 
    }

    workspace.notes[id] = note;
    workspace.indexes.title_to_note_id[note.title] = id;
    workspace.indexes.backlinks[id] = [];
    
    logNotification(workspace, 'system', `Created ${note.type} note: ${title}`, id);

    return note;
};

// Update Occurrences based on note content (Milestone 5 Step 7)
export const updateOccurrencesForNote = (workspace: Workspace, note: Note) => {
    if (!note.content_plain) return;
    
    const scanResults = scanTextForGlossaryTerms(note.content_plain, workspace.glossary.index.lookup);
    const foundTermIds = new Set(scanResults.keys());
    const occurrences = workspace.glossary.occurrences;
    const now = Date.now();

    // 1. Remove this note from terms that no longer contain it
    Object.keys(occurrences.terms).forEach(termId => {
        const termData = occurrences.terms[termId];
        if (termData.noteIds.includes(note.id) && !foundTermIds.has(termId)) {
            termData.noteIds = termData.noteIds.filter(id => id !== note.id);
            if (termData.snippetsByNote) delete termData.snippetsByNote[note.id];
            if (termData.lastSeenAtByNote) delete termData.lastSeenAtByNote[note.id];
        }
    });

    // 2. Add/Update for found terms
    scanResults.forEach((snippets, termId) => {
        if (!occurrences.terms[termId]) {
            occurrences.terms[termId] = {
                noteIds: [],
                snippetsByNote: {},
                lastSeenAtByNote: {}
            };
        }
        const termData = occurrences.terms[termId];
        
        // Add ID if missing
        if (!termData.noteIds.includes(note.id)) {
            termData.noteIds.push(note.id);
            if (termData.noteIds.length > 200) {
                const removedId = termData.noteIds.shift();
                if (removedId) {
                    delete termData.snippetsByNote[removedId];
                    delete termData.lastSeenAtByNote[removedId];
                }
            }
        }

        // Update Metadata
        termData.snippetsByNote[note.id] = snippets;
        termData.lastSeenAtByNote[note.id] = now;
    });

    occurrences.updatedAt = now;
    
    // Trigger Save
    vaultService.debouncedSaveOccurrences(occurrences);
};

export const updateNote = (workspace: Workspace, note: Note): Workspace => {
    const oldNote = workspace.notes[note.id];
    
    if (oldNote && oldNote.title !== note.title) {
        const originalTitle = note.title.trim();
        let finalTitle = originalTitle || "Untitled Record";
        finalTitle = getUniqueTitle(workspace, finalTitle, note.id);
        
        if (finalTitle !== originalTitle) {
             logNotification(workspace, 'warning', `Title adjusted to keep unique: ${finalTitle}`, note.id);
        }
        note.title = finalTitle;
        handleRename(workspace, note, oldNote.title);
    }

    if (oldNote && oldNote.status !== note.status) {
        logNotification(workspace, 'statusChange', `Status changed: ${oldNote.status} -> ${note.status}`, note.id);
    }

    if (note.unresolved && !workspace.indexes.unresolved_note_ids.includes(note.id)) {
        workspace.indexes.unresolved_note_ids.push(note.id);
    } else if (!note.unresolved && workspace.indexes.unresolved_note_ids.includes(note.id)) {
        workspace.indexes.unresolved_note_ids = workspace.indexes.unresolved_note_ids.filter(id => id !== note.id);
    }

    note.updatedAt = Date.now();
    note.content_plain = noteContentToPlainText(note);
    updateLinkGraph(workspace, note);
    workspace.notes[note.id] = note;
    scanContentAndCreateUnresolved(workspace, note.id);
    
    updateOccurrencesForNote(workspace, note);

    return { ...workspace };
};

export const resolveNote = (workspace: Workspace, noteId: string): Workspace => {
    const note = workspace.notes[noteId];
    if (!note) return workspace;
    note.unresolved = false;
    note.updatedAt = Date.now();
    workspace.indexes.unresolved_note_ids = workspace.indexes.unresolved_note_ids.filter(id => id !== noteId);
    vaultService.onNoteChange(note);
    logNotification(workspace, 'success', `Resolved note: ${note.title}`, noteId);
    return { ...workspace };
};

// --- Folder Management ---

const getFolderPath = (workspace: Workspace, folderId: string): string => {
    const folder = workspace.folders[folderId];
    if (!folder) return '';
    const parentPath = folder.parentId ? getFolderPath(workspace, folder.parentId) : '';
    return parentPath ? `${parentPath}/${folder.name}` : folder.name;
};

export const createFolder = (workspace: Workspace, name: string, parentId: string | null = null): ID => {
    const id = generateId();
    const siblings = Object.values(workspace.folders).filter(f => f.parentId === parentId);
    let finalName = name;
    let counter = 2;
    while(siblings.some(f => f.name === finalName)) {
        finalName = `${name} ${counter}`;
        counter++;
    }

    const now = Date.now();
    workspace.folders[id] = {
        id,
        name: finalName,
        type: 'user',
        parentId,
        createdAt: now,
        updatedAt: now,
        order: siblings.length
    };

    const fullPath = getFolderPath(workspace, id);
    vaultService.createDirectory(fullPath);
    vaultService.saveMetadataNow(workspace);

    return id;
};

export const renameFolder = (workspace: Workspace, folderId: string, newName: string): boolean => {
    const folder = workspace.folders[folderId];
    if (!folder || folder.type === 'system') return false;
    const siblings = Object.values(workspace.folders).filter(f => f.parentId === folder.parentId && f.id !== folderId);
    if (siblings.some(f => f.name === newName)) return false; 
    vaultService.renameFolderOnDisk(folderId, newName);
    return true; 
};

export const deleteFolder = (workspace: Workspace, folderId: string): boolean => {
    const folder = workspace.folders[folderId];
    if (!folder || folder.type === 'system') return false;
    const childFolders = Object.values(workspace.folders).some(f => f.parentId === folderId);
    const childNotes = Object.values(workspace.notes).some(n => n.folderId === folderId);
    if (childFolders || childNotes) return false;
    delete workspace.folders[folderId];
    return true;
};

export const moveNote = (workspace: Workspace, noteId: string, targetFolderId: string) => {
    const note = workspace.notes[noteId];
    if (note && workspace.folders[targetFolderId]) {
        note.folderId = targetFolderId;
        note.updatedAt = Date.now();
    }
};

// --- Collections Management ---

export const createCollection = (workspace: Workspace, name: string): ID => {
    const id = generateId();
    const collection: Collection = {
        id,
        name,
        noteIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    workspace.collections[id] = collection;
    vaultService.debouncedSaveCollections({ 
        schemaVersion: 1, 
        updatedAt: Date.now(), 
        collections: workspace.collections 
    });
    return id;
};

export const deleteCollection = (workspace: Workspace, collectionId: string) => {
    if (workspace.collections[collectionId]) {
        delete workspace.collections[collectionId];
        vaultService.debouncedSaveCollections({ 
            schemaVersion: 1, 
            updatedAt: Date.now(), 
            collections: workspace.collections 
        });
    }
};

export const addToCollection = (workspace: Workspace, collectionId: string, noteId: string) => {
    const collection = workspace.collections[collectionId];
    if (collection && !collection.noteIds.includes(noteId)) {
        collection.noteIds.push(noteId);
        collection.updatedAt = Date.now();
        vaultService.debouncedSaveCollections({ 
            schemaVersion: 1, 
            updatedAt: Date.now(), 
            collections: workspace.collections 
        });
        logNotification(workspace, 'info', `Added note to collection: ${collection.name}`, noteId);
    }
};

export const removeFromCollection = (workspace: Workspace, collectionId: string, noteId: string) => {
    const collection = workspace.collections[collectionId];
    if (collection) {
        collection.noteIds = collection.noteIds.filter(id => id !== noteId);
        collection.updatedAt = Date.now();
        vaultService.debouncedSaveCollections({ 
            schemaVersion: 1, 
            updatedAt: Date.now(), 
            collections: workspace.collections 
        });
    }
};

// --- Maps Management ---

export const createMap = (workspace: Workspace, name: string): ID => {
    const id = generateId();
    const map: MapData = {
        mapId: id,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        viewState: { zoom: 1, panX: 0, panY: 0 },
        nodes: [],
        areas: []
    };
    workspace.maps.maps[id] = map;
    vaultService.debouncedSaveMaps(workspace.maps);
    return id;
};

// --- Glossary Management (Milestone 5) ---

export const lookupGlossaryTermId = (workspace: Workspace, text: string): string | null => {
    const normalized = normalizeKey(text);
    if (!normalized) return null;
    
    // Check Exact Match in index lookup
    // The index lookup should ideally contain both primary and aliases normalized.
    // If multiple entries map to same normalized key, primary wins if we built the index correctly.
    // Assuming workspace.glossary.index.lookup is populated properly.
    return workspace.glossary.index.lookup[normalized] || null;
};

export const validateGlossaryTerm = (workspace: Workspace, term: GlossaryTerm): string | null => {
    const index = workspace.glossary.index;
    
    // Check Primary Name Collision
    const normPrimary = normalizeKey(term.primaryName);
    if (!normPrimary) return "Primary name cannot be empty.";
    
    const existingId = index.lookup[normPrimary];
    if (existingId && existingId !== term.termId) {
        const conflict = workspace.glossary.terms[existingId]?.primaryName || "Unknown Term";
        return `Name "${term.primaryName}" conflicts with existing term "${conflict}".`;
    }

    // Check Alias Collisions
    for (const alias of term.aliases) {
        const normAlias = normalizeKey(alias);
        const aliasId = index.lookup[normAlias];
        if (aliasId && aliasId !== term.termId) {
            const conflict = workspace.glossary.terms[aliasId]?.primaryName || "Unknown Term";
            return `Alias "${alias}" conflicts with existing term "${conflict}".`;
        }
    }

    return null;
};

export const createGlossaryTerm = (workspace: Workspace, name: string, definitionInput?: string, universeScopes: string[] = []): ID => {
    const termId = generateId();
    const now = Date.now();
    
    // Uniqueness check
    const normalized = normalizeKey(name);
    if (!normalized) return "";

    if (workspace.glossary.index.lookup[normalized]) {
        logNotification(workspace, 'warning', `Term "${name}" already exists.`);
        return workspace.glossary.index.lookup[normalized];
    }

    // Default definition structure
    const def = definitionInput ? {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: definitionInput }] }]
    } : { type: 'doc', content: [] };

    // GUARDRAIL: Strict canonical enforcement
    const term: GlossaryTerm = {
        schemaVersion: 1,
        termId,
        primaryName: name,
        aliases: [],
        definitionRichText: def,
        universeScopes: universeScopes,
        createdAt: now,
        updatedAt: now,
        canonical: true // Always enforced
    };

    // Update Memory
    workspace.glossary.terms[termId] = term;
    workspace.glossary.index.lookup[normalized] = termId;
    workspace.glossary.index.terms[termId] = {
        primaryName: term.primaryName,
        aliases: term.aliases,
        universeScopes: term.universeScopes,
        createdAt: term.createdAt,
        updatedAt: term.updatedAt,
        canonical: true
    };

    // Update Persistence
    vaultService.saveGlossaryTerm(term);
    vaultService.saveGlossaryIndex(workspace.glossary.index);
    logNotification(workspace, 'success', `Created canon glossary term: ${name}`, termId);
    
    return termId;
};

export const createBlankGlossaryTerm = (workspace: Workspace): string => {
    const id = generateId();
    const name = `Untitled Term ${id.slice(0, 4)}`;
    return createGlossaryTerm(workspace, name);
};

export const updateGlossaryTerm = (workspace: Workspace, term: GlossaryTerm) => {
    const oldTerm = workspace.glossary.terms[term.termId];
    
    // Validate first
    const error = validateGlossaryTerm(workspace, term);
    if (error) {
        logNotification(workspace, 'warning', `Update failed: ${error}`);
        return; 
    }

    // GUARDRAIL: Sanitize term to ensure it is always canonical and has no status
    const safeTerm = { ...term };
    delete (safeTerm as any).status; // Forbidden field
    delete (safeTerm as any).unresolved; // Forbidden field
    safeTerm.canonical = true; // Enforced

    // 1. Remove OLD index entries
    if (oldTerm) {
        const oldKeys = [oldTerm.primaryName, ...oldTerm.aliases].map(normalizeKey);
        oldKeys.forEach(k => delete workspace.glossary.index.lookup[k]);
    }

    // 2. Add NEW index entries
    const newKeys = [safeTerm.primaryName, ...safeTerm.aliases].map(normalizeKey);
    newKeys.forEach(key => {
        workspace.glossary.index.lookup[key] = safeTerm.termId;
    });

    // 3. Update Term & Index Summary
    safeTerm.updatedAt = Date.now();
    workspace.glossary.terms[safeTerm.termId] = safeTerm;
    workspace.glossary.index.terms[safeTerm.termId] = {
        primaryName: safeTerm.primaryName,
        aliases: safeTerm.aliases,
        universeScopes: safeTerm.universeScopes,
        createdAt: safeTerm.createdAt,
        updatedAt: safeTerm.updatedAt,
        canonical: true
    };
    workspace.glossary.index.updatedAt = Date.now();
    
    // 4. Persist
    vaultService.saveGlossaryTerm(safeTerm);
    vaultService.saveGlossaryIndex(workspace.glossary.index);
};

export const deleteGlossaryTerm = (workspace: Workspace, termId: string) => {
    const term = workspace.glossary.terms[termId];
    if (!term) return;

    // Remove index entries
    const keys = [term.primaryName, ...term.aliases].map(normalizeKey);
    keys.forEach(k => {
        if (workspace.glossary.index.lookup[k] === termId) {
            delete workspace.glossary.index.lookup[k];
        }
    });
    delete workspace.glossary.index.terms[termId];
    workspace.glossary.index.updatedAt = Date.now();
    
    // Remove from memory
    delete workspace.glossary.terms[termId];
    
    // Persist removal
    vaultService.deleteGlossaryTerm(termId);
    vaultService.saveGlossaryIndex(workspace.glossary.index);
    logNotification(workspace, 'info', `Deleted glossary term: ${term.primaryName}`);
};

export const addPendingTerm = (workspace: Workspace, name: string, context?: { noteId: string, snippet: string }) => {
    const normalized = normalizeKey(name);
    if (workspace.glossary.index.lookup[normalized]) return; // Exists

    // Check existing pending
    const existingPending = Object.values(workspace.glossary.pending).find(p => normalizeKey(p.proposedName) === normalized);
    
    if (existingPending) {
        if (context && !existingPending.detectedInNoteIds.includes(context.noteId)) {
            existingPending.detectedInNoteIds.push(context.noteId);
            existingPending.detectedSnippets.push(context.snippet);
            vaultService.savePendingTerm(existingPending);
        }
        return;
    }

    const pendingId = generateId();
    const pending: PendingTerm = {
        schemaVersion: 1,
        pendingId,
        proposedName: name,
        detectedInNoteIds: context ? [context.noteId] : [],
        detectedSnippets: context ? [context.snippet] : [],
        reason: 'manual',
        createdAt: Date.now()
    };

    workspace.glossary.pending[pendingId] = pending;
    vaultService.savePendingTerm(pending);
    logNotification(workspace, 'info', `Added "${name}" to pending terms.`);
};

// Deterministic Scanning hook
export const scanNoteForPending = (workspace: Workspace, note: Note) => {
    if (!note.content_plain) return;
    
    // Defer to avoid blocking UI immediately on save
    setTimeout(() => {
        const candidates = extractCandidateTerms(note.content_plain || "");
        
        candidates.forEach(c => {
            const norm = normalizeKey(c.term);
            
            // 1. Check if exists in Glossary
            if (workspace.glossary.index.lookup[norm]) return;

            // 2. Check if already pending (handled in addPendingTerm logic)
            addPendingTerm(workspace, c.term, { noteId: note.id, snippet: c.context });
        });
    }, 1000);
};

export const approvePendingTerm = (workspace: Workspace, pendingId: string, termPayload?: Partial<GlossaryTerm>) => {
    const pending = workspace.glossary.pending[pendingId];
    if (!pending) return;

    // Use current pending proposedName as base
    const termId = createGlossaryTerm(workspace, pending.proposedName, undefined, termPayload?.universeScopes);
    
    // Apply extra payload if provided after creation
    if (termPayload?.definitionRichText) {
        const term = workspace.glossary.terms[termId];
        updateGlossaryTerm(workspace, { ...term, definitionRichText: termPayload.definitionRichText });
    }

    delete workspace.glossary.pending[pendingId];
    vaultService.deletePendingTerm(pendingId);
    return termId;
};

export const mergePendingAsAlias = (workspace: Workspace, pendingId: string, targetTermId: string) => {
    const pending = workspace.glossary.pending[pendingId];
    const targetTerm = workspace.glossary.terms[targetTermId];
    
    if (!pending || !targetTerm) return;

    const normalizedAlias = normalizeKey(pending.proposedName);
    
    // Check collision on other terms (skip target term check itself to allow idempotent merge if already there)
    if (workspace.glossary.index.lookup[normalizedAlias] && workspace.glossary.index.lookup[normalizedAlias] !== targetTermId) {
        logNotification(workspace, 'warning', `Cannot merge: "${pending.proposedName}" conflicts with another term.`);
        return;
    }

    // Add Alias if new
    if (!targetTerm.aliases.some(a => normalizeKey(a) === normalizedAlias) && normalizeKey(targetTerm.primaryName) !== normalizedAlias) {
        targetTerm.aliases.push(pending.proposedName);
        updateGlossaryTerm(workspace, targetTerm);
    }

    // Cleanup Pending
    delete workspace.glossary.pending[pendingId];
    vaultService.deletePendingTerm(pendingId);
    logNotification(workspace, 'success', `Merged "${pending.proposedName}" into "${targetTerm.primaryName}".`);
};

export const ignorePendingTerm = (workspace: Workspace, pendingId: string) => {
    delete workspace.glossary.pending[pendingId];
    vaultService.deletePendingTerm(pendingId);
};

// --- Misc ---

export const togglePin = (workspace: Workspace, noteId: string) => {
    const note = workspace.notes[noteId];
    if (note) {
        note.pinned = !note.pinned;
        if (note.pinned && !workspace.pinnedNoteIds.includes(noteId)) {
            workspace.pinnedNoteIds.push(noteId);
        } else {
            workspace.pinnedNoteIds = workspace.pinnedNoteIds.filter(id => id !== noteId);
        }
    }
};

export const clearUnresolvedOrigins = (workspace: Workspace, noteId: string) => {
    const note = workspace.notes[noteId];
    if (note && note.system) {
        note.system.unresolvedOrigins = [];
        note.updatedAt = Date.now();
        vaultService.onNoteChange(note); 
        logNotification(workspace, 'info', `Cleared origins for note: ${note.title}`, noteId);
    }
};
