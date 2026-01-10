
import { Workspace, Note } from '../types';
import { parseWikiLinks } from './linkService';
import { ensureUnresolvedNote } from './storageService';

// --- Helper: Convert legacy string/v1 to v2 doc with InternalLinks ---

export const migrateContent = (note: Note, workspace: Workspace): { doc: any, changed: boolean } => {
    const content = note.content;
    let doc = { type: 'doc', content: [] as any[] };
    let changed = false;

    // Case 1: String content (Legacy)
    if (typeof content === 'string') {
        const paragraphs = content.split('\n');
        doc.content = paragraphs.map(line => {
            const tokens = parseWikiLinks(line);
            const contentNodes: any[] = [];
            
            tokens.forEach(token => {
                if (token.kind === 'text') {
                    if (token.value) contentNodes.push({ type: 'text', text: token.value });
                } else if (token.kind === 'link') {
                    const targetId = resolveOrCreateIndex(token.title, workspace, note.id);
                    contentNodes.push({
                        type: 'internalLink',
                        attrs: {
                            targetId: targetId,
                            display: token.display,
                            fallbackTitle: token.title
                        }
                    });
                }
            });

            // If empty line, ensure empty text node or paragraph structure logic?
            // TipTap starter kit handles empty paragraphs fine usually, but empty text node is invalid.
            if (contentNodes.length === 0) {
                // Empty paragraph
                return { type: 'paragraph' };
            }
            
            // Check for specific block types (headers, lists) based on markdown syntax
            // Simple markdown parser fallback for Heading/List
            const textContent = line;
            if (textContent.startsWith('# ')) {
                return { type: 'heading', attrs: { level: 1 }, content: contentNodes.map(fixHeadingContent) };
            } else if (textContent.startsWith('## ')) {
                return { type: 'heading', attrs: { level: 2 }, content: contentNodes.map(fixHeadingContent) };
            } else if (textContent.startsWith('### ')) {
                return { type: 'heading', attrs: { level: 3 }, content: contentNodes.map(fixHeadingContent) };
            } else if (textContent.startsWith('- ')) {
                // Lists are complex in basic migration. For MVP migration step 2, treat as paragraph with bullet char
                // To do real list migration requires state machine.
                // We'll treat as paragraph to prevent data loss, formatting can be fixed by user or advanced parser later.
                return { type: 'paragraph', content: contentNodes };
            }

            return { type: 'paragraph', content: contentNodes };
        });
        changed = true;
    } 
    // Case 2: TipTap JSON v1 (Legacy Doc)
    else if (typeof content === 'object' && (!content.version || content.version < 2)) {
        // Traverse and replace text nodes containing [[links]]
        doc = JSON.parse(JSON.stringify(content.doc || content)); // Handle {doc: ...} or direct doc
        
        const traverse = (node: any) => {
            if (node.type === 'text' && node.text && node.text.includes('[[')) {
                // Replace this text node with array of nodes (text + links)
                // BUT traverse expects to modify node in place or return replacement?
                // Standard recursive traversals on JSON trees are tricky for splitting nodes.
                // We'll rely on the fact that 'content' is an array in parent.
            }
            if (node.content) {
                node.content = node.content.flatMap((child: any) => {
                    if (child.type === 'text' && child.text && child.text.includes('[[')) {
                        const tokens = parseWikiLinks(child.text);
                        return tokens.map(token => {
                            if (token.kind === 'text') return { type: 'text', text: token.value, marks: child.marks };
                            // Link
                            const targetId = resolveOrCreateIndex(token.title, workspace, note.id);
                            return {
                                type: 'internalLink',
                                attrs: {
                                    targetId,
                                    display: token.display,
                                    fallbackTitle: token.title
                                },
                                // Internal Links might behave better without marks or with them? 
                                // Marks (bold/italic) allowed.
                                marks: child.marks 
                            };
                        });
                    }
                    traverse(child);
                    return [child];
                });
            }
        };
        traverse(doc);
        changed = true; // Assume changed if we ran this pass (optimization: check if actually replaced)
    } 
    // Case 3: V2 or newer
    else {
        doc = content.doc;
        changed = false;
    }

    return { doc, changed };
};

const resolveOrCreateIndex = (title: string, workspace: Workspace, sourceId: string): string => {
    // Check index
    const existingId = workspace.indexes.title_to_note_id[title];
    if (existingId) return existingId;

    // Create unresolved
    // This mutates workspace state in memory. Storage persistence handles saving.
    return ensureUnresolvedNote(workspace, title, sourceId);
};

const fixHeadingContent = (node: any) => {
    // Remove markdown markers from text content if simple conversion
    if (node.type === 'text') {
        return { ...node, text: node.text.replace(/^#+\s/, '') };
    }
    return node;
};
