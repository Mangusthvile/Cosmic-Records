
import { 
  Workspace, Note, NoteType, NoteStatus, 
  ID, UserPreferences, GlossaryTerm, UniverseTag, Folder, Collection,
  NotificationLogItem,
  CollectionsData,
  MapData
} from "../types";
import { parseWikiLinks, extractLinkTitles, extractOutboundLinks } from "./linkService";
import { vaultService, noteContentToPlainText } from "./vaultService";

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
  ui: { gray_out_outdated_titles: true, show_badges_in_search: true, show_unresolved_prominently: true }
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

export const createGlossaryTerm = (workspace: Workspace, term: string, definition: string): ID => {
    const id = generateId();
    workspace.glossary.terms[id] = {
        id,
        term,
        aliases: [],
        definitionDoc: { type: "doc", content: [] },
        definition_plain: definition,
        linksTo: [],
        universeTags: [],
        sourceRefs: [],
        isCanon: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    return id;
};
