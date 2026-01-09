
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
 * Optimization: If content is not loaded, this check skips.
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
            // Link target doesn't exist (technically unresolved)
            return true; 
        }
    }
    return false;
};

/**
 * Generates a highlighted snippet from content or excerpt
 */
const getSnippet = (content: string, query: string, fallbackExcerpt?: string): string => {
    // Priority: content match -> excerpt -> placeholder
    
    if (content) {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerContent.indexOf(lowerQuery);
        
        if (index === -1) return fallbackExcerpt || content.substring(0, 100);
        
        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + query.length + 60);
        
        let text = content.substring(start, end);
        if (start > 0) text = "..." + text;
        if (end < content.length) text = text + "...";
        return text;
    }

    return fallbackExcerpt || "";
};

/**
 * Main Search Function
 * Relies primarily on metadata/index for filtering to ensure performance.
 * Does NOT scan file content unless loaded.
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

            // Unresolved Filter
            if (filters.unresolved !== 'all') {
                if (filters.unresolved === 'unresolved' && !note.unresolved) return false;
                if (filters.unresolved === 'resolved' && note.unresolved) return false;
            }

            // Query Matching
            if (lowerQuery) {
                const inTitle = note.title.toLowerCase().includes(lowerQuery);
                
                // Match against excerpt if content not loaded, or content if loaded
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
                score = 0; // No query, purely sort by rules
            }
            
            return {
                note,
                score,
                snippet: getSnippet(note.content || "", lowerQuery, note.excerpt),
                hasUnresolvedLinks: hasUnresolvedOutgoingLinks(workspace, note)
            };
        })
        .sort((a, b) => {
            // Ranking Rules
            
            // 1. Unresolved First (Aggressive)
            if (a.note.unresolved !== b.note.unresolved) {
                return a.note.unresolved ? -1 : 1;
            }

            // 2. Pinned Priority
            if (a.note.pinned !== b.note.pinned) {
                return a.note.pinned ? -1 : 1;
            }

            // 3. Relevance Score
            if (a.score !== b.score) {
                return b.score - a.score;
            }

            // 4. Recency
            return b.note.updatedAt - a.note.updatedAt;
        });
};
