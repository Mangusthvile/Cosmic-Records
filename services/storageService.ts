
import { 
  Workspace, Note, NoteType, NoteStatus, 
  NoteMetadata, CharacterMeta, PlaceMeta, GeneralMeta,
  ID, RichDoc, UserPreferences, GlossaryTerm, UniverseTag, Folder, Collection,
  NotificationLogItem
} from "../types";
import { parseWikiLinks, rewriteLinks, extractLinkTitles } from "./linkService";

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

const SYSTEM_FOLDERS: Record<ID, Folder> = {
    'inbox': { id: 'inbox', name: 'Inbox', type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 0 },
    'unresolved': { id: 'unresolved', name: 'Unresolved', type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 1 },
    'archived': { id: 'archived', name: 'Archived', type: 'system', parentId: null, createdAt: 0, updatedAt: 0, order: 999 }
};

// --- Helpers for Indexes ---

const rebuildBacklinks = (workspace: Workspace) => {
    const backlinks: Record<ID, ID[]> = {};
    
    // Initialize
    Object.keys(workspace.notes).forEach(id => backlinks[id] = []);

    // Scan all notes
    Object.values(workspace.notes).forEach(sourceNote => {
        const titles = extractLinkTitles(sourceNote.content || "");
        titles.forEach(title => {
            const targetId = workspace.indexes.title_to_note_id[title];
            if (targetId) {
                if (!backlinks[targetId]) backlinks[targetId] = [];
                if (!backlinks[targetId].includes(sourceNote.id)) {
                    backlinks[targetId].push(sourceNote.id);
                }
            }
        });
    });

    workspace.indexes.backlinks = backlinks;
};

// --- Notification Logging ---

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
    // Prepend to log
    workspace.notificationLog = [logItem, ...workspace.notificationLog].slice(0, 100); // Keep last 100
};

// --- Core Note Logic ---

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

// --- Unresolved & Linking Logic ---

const ensureUnresolvedNote = (workspace: Workspace, title: string, sourceNoteId: string): ID => {
    // Check if exists
    if (workspace.indexes.title_to_note_id[title]) {
        const existingId = workspace.indexes.title_to_note_id[title];
        // Append source if not already there
        const note = workspace.notes[existingId];
        // Note: note could be a shell, we just update metadata here safely
        if (note.unresolvedSources && !note.unresolvedSources.includes(sourceNoteId)) {
            note.unresolvedSources.push(sourceNoteId);
        } else if (!note.unresolvedSources) {
            note.unresolvedSources = [sourceNoteId];
        }
        return existingId;
    }

    // Create new unresolved note
    const id = generateId();
    const now = Date.now();
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
        content: `Unresolved link created from [[${workspace.notes[sourceNoteId]?.title || 'Unknown source'}]].`,
        pinned: false,
        tag_ids: [],
        metadata: { kind: 'general', data: {} }
    };

    workspace.notes[id] = note;
    workspace.indexes.title_to_note_id[title] = id;
    workspace.indexes.unresolved_note_ids.push(id);
    
    // LOG IT
    logNotification(workspace, 'warning', `Unresolved note created: ${title}`, id);

    return id;
};

const scanContentAndCreateUnresolved = (workspace: Workspace, noteId: string) => {
    const note = workspace.notes[noteId];
    if (!note || !note.content) return; // Skip if content not loaded or empty

    const linkedTitles = extractLinkTitles(note.content || "");
    
    linkedTitles.forEach(title => {
        ensureUnresolvedNote(workspace, title, noteId);
    });
};

const handleRename = (workspace: Workspace, note: Note, oldTitle: string) => {
    // 1. Rewrite links in ALL notes
    // Optimization: This requires full scan. For large vaults, this is expensive. 
    // In persisted index milestone, we should only do this if users explicitly want it or handle it lazily?
    // For now, we iterate `workspace.notes`. Since many are shells, we check `content` presence.
    // If content is missing, we skip rewriting. This is a limitation of lazy loading without server-side search.
    // Ideally, we'd flag them as "needs link update" or load them.
    // MVP: Only update loaded notes.
    Object.values(workspace.notes).forEach(n => {
        if (!n.content) return; 
        const newContent = rewriteLinks(n.content, oldTitle, note.title);
        if (newContent !== n.content) {
            n.content = newContent;
            n.content_plain = newContent; 
            n.updatedAt = Date.now();
        }
    });

    // 2. Update Index
    delete workspace.indexes.title_to_note_id[oldTitle];
    workspace.indexes.title_to_note_id[note.title] = note.id;
};

// --- Public Operations ---

export const createNote = (
    workspace: Workspace, 
    baseTitle: string = "New Note", 
    type: string = "General", 
    method: 'blank' | 'ai' = 'blank',
    targetFolderId: string = 'inbox'
): Note => {
    const id = generateId();
    const title = getUniqueTitle(workspace, baseTitle);
    const now = Date.now();

    const note: Note = {
        id,
        title,
        type,
        status: "Draft",
        unresolved: false,
        unresolvedSources: [],
        universeTag: null,
        folderId: targetFolderId,
        createdAt: now,
        updatedAt: now,
        content: "",
        pinned: false,
        tag_ids: [],
        metadata: { kind: 'general', data: {} } 
    };

    if (method === 'ai') {
        note.aiInterview = {
            isActive: true,
            step: 'start',
            transcript: []
        };
        note.title = getUniqueTitle(workspace, `${baseTitle} (AI)`); 
    }

    workspace.notes[id] = note;
    workspace.indexes.title_to_note_id[note.title] = id;
    
    // Initial backlinks build is empty for new note
    workspace.indexes.backlinks[id] = [];
    
    // LOG IT
    logNotification(workspace, 'system', `Created new note: ${title}`, id);

    return note;
};

export const updateNote = (workspace: Workspace, note: Note): Workspace => {
    const oldNote = workspace.notes[note.id];
    
    // 1. Rename Safety
    if (oldNote && oldNote.title !== note.title) {
        // Enforce uniqueness again to be safe
        note.title = getUniqueTitle(workspace, note.title, note.id);
        handleRename(workspace, note, oldNote.title);
        logNotification(workspace, 'info', `Renamed note from "${oldNote.title}" to "${note.title}"`, note.id);
    }

    // 2. Status Change Logging
    if (oldNote && oldNote.status !== note.status) {
        logNotification(workspace, 'statusChange', `Status changed: ${oldNote.status} -> ${note.status}`, note.id);
    }

    // 3. Unresolved Folder Logic
    if (note.unresolved && note.folderId !== 'unresolved') {
        note.folderId = 'unresolved';
    } 

    note.updatedAt = Date.now();
    workspace.notes[note.id] = note;
    note.content_plain = note.content; 

    // 4. Scan for Links (Auto-create unresolved)
    scanContentAndCreateUnresolved(workspace, note.id);

    // 5. Rebuild Backlinks
    // Only rebuild if content loaded and changed
    if (oldNote && note.content && (oldNote.content !== note.content || oldNote.title !== note.title)) {
        rebuildBacklinks(workspace);
    }

    return { ...workspace };
};

// --- Folder Management ---

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
    return id;
};

export const renameFolder = (workspace: Workspace, folderId: string, newName: string): boolean => {
    const folder = workspace.folders[folderId];
    if (!folder || folder.type === 'system') return false;

    const siblings = Object.values(workspace.folders).filter(f => f.parentId === folder.parentId && f.id !== folderId);
    if (siblings.some(f => f.name === newName)) return false; 

    folder.name = newName;
    folder.updatedAt = Date.now();
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

export const togglePin = (workspace: Workspace, noteId: string) => {
    const note = workspace.notes[noteId];
    if (note) {
        note.pinned = !note.pinned;
        // Sync legacy array for safety
        if (note.pinned && !workspace.pinnedNoteIds.includes(noteId)) {
            workspace.pinnedNoteIds.push(noteId);
        } else {
            workspace.pinnedNoteIds = workspace.pinnedNoteIds.filter(id => id !== noteId);
        }
    }
};

export const parseLinksAndUpdateWorkspace = (workspace: Workspace, sourceNoteId: string, content: string): Workspace => {
    const note = workspace.notes[sourceNoteId];
    if (note) {
        note.content = content;
        note.content_plain = content;
        scanContentAndCreateUnresolved(workspace, sourceNoteId);
    }
    return { ...workspace };
};

export const createGlossaryTerm = (workspace: Workspace, term: string, definition: string): ID => {
    const id = generateId();
    workspace.glossary.terms[id] = {
        id,
        term,
        definition_rich: { type: "doc", content: [] },
        definition_plain: definition,
        referenced_term_ids: [],
        universe_tag_ids: [],
        sources: { originating_note_ids: [] },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    return id;
};

export const createTag = (workspace: Workspace, tagName: string): ID => {
    const id = generateId();
    workspace.tags[id] = { id, name: tagName, color: null, created_at: new Date().toISOString() };
    return id;
};

export const createUniverseTag = (workspace: Workspace, name: string): ID => {
    // Check if exists in settings
    if (!workspace.settings.universeTags.tags.includes(name)) {
        workspace.settings.universeTags.tags.push(name);
    }
    return name; // Return name as ID since they are strings now
};
