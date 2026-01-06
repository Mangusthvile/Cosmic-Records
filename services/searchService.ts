
import { Workspace, Note, SearchFilters } from '../types';
import { extractLinkTitles } from './linkService';

export interface SearchResult {
    note: Note;
    score: number;
    snippet: string;
    hasUnresolvedLinks: boolean;
}

/**
 * Recursive function to get all descendant folder IDs
 */
export const getDescendantFolderIds = (workspace: Workspace, folderId: string): string[] => {
    const directChildren = Object.values(workspace.folders).filter(f => f.parentId === folderId);
    let allIds = directChildren.map(f => f.id);
    
    for (const child of directChildren) {
        allIds = [...allIds, ...getDescendantFolderIds(workspace, child.id)];
    }
    return allIds;
};

/**
 * Checks if a note contains outgoing links to unresolved notes
 * Optimization: If content is not loaded, this check skips (or relies on indexed link data if we had it).
 * For now, only checks loaded notes.
 */
export const hasUnresolvedOutgoingLinks = (workspace: Workspace, note: Note): boolean => {
    if (!note.content || note.content.length === 0) return false; // Skip unloaded
    const titles = extractLinkTitles(note.content);
    
    for (const title of titles) {
        const id = workspace.indexes.title_to_note_id[title];
        if (id) {
            const target = workspace.notes[id];
            if (target && target.unresolved) return true;
        } else {
            // Link target doesn't exist (technically unresolved, though step 8 auto-creates)
            return true; 
        }
    }
    return false;
};

/**
 * Generates a highlighted snippet from content
 */
const getSnippet = (content: string, query: string, fallbackExcerpt?: string): string => {
    // If content is empty (not loaded), use excerpt
    if (!content && fallbackExcerpt) return fallbackExcerpt;
    if (!content) return "";

    if (!query) return content.substring(0, 100);
    
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    
    if (index === -1) return content.substring(0, 100);
    
    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + query.length + 60);
    
    let text = content.substring(start, end);
    if (start > 0) text = "..." + text;
    if (end < content.length) text = text + "...";
    
    return text;
};

/**
 * Main Search Function
 * Relies primarily on metadata/index for filtering.
 */
export const searchNotes = (workspace: Workspace, query: string, filters: SearchFilters): SearchResult[] => {
    const allNotes = Object.values(workspace.notes);
    const lowerQuery = query.toLowerCase().trim();

    // 1. Prepare Filter Sets
    let validFolderIds = new Set<string>();
    if (filters.folderId !== 'all') {
        validFolderIds.add(filters.folderId);
        if (filters.includeSubfolders) {
            getDescendantFolderIds(workspace, filters.folderId).forEach(id => validFolderIds.add(id));
        }
    }

    return allNotes
        .filter(note => {
            // --- FILTERING ---
            
            // Folder
            if (filters.folderId !== 'all') {
                if (!validFolderIds.has(note.folderId)) return false;
            }
            
            // Universe Tag
            if (filters.universeTagId !== 'all') {
                if (filters.universeTagId === 'none') {
                    if (note.universeTag !== null) return false;
                } else {
                    if (note.universeTag !== filters.universeTagId) return false;
                }
            }

            // Type
            if (filters.type !== 'all') {
                if (note.type !== filters.type) return false;
            }

            // Status
            if (filters.status !== 'all') {
                if (note.status !== filters.status) return false;
            }

            // Query Matching (If query exists)
            // Match against Title (Always valid) OR Content (If loaded) OR Excerpt (Index)
            if (lowerQuery) {
                const inTitle = note.title.toLowerCase().includes(lowerQuery);
                
                // Use excerpt if content missing
                const searchableText = (note.content || note.excerpt || "").toLowerCase();
                const inContent = searchableText.includes(lowerQuery);
                
                return inTitle || inContent;
            }

            return true;
        })
        .map(note => {
            // --- SCORING ---
            let score = 0;
            const noteLowerTitle = note.title.toLowerCase();
            
            if (lowerQuery) {
                if (noteLowerTitle === lowerQuery) score += 100; // Exact title match
                else if (noteLowerTitle.startsWith(lowerQuery)) score += 80; // Starts with
                else if (noteLowerTitle.includes(lowerQuery)) score += 50; // Title contains
                else score += 10; // Content matches (implied by filter pass)
            } else {
                score = note.updatedAt; // Default sort by recent if no query
            }
            
            return {
                note,
                score,
                snippet: getSnippet(note.content || "", lowerQuery, note.excerpt),
                hasUnresolvedLinks: hasUnresolvedOutgoingLinks(workspace, note)
            };
        })
        .sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt);
};
