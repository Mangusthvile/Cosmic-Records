
import React, { useMemo } from 'react';
import { Note } from '../../types';
import { AlignLeft } from 'lucide-react';

interface OutlineWidgetProps {
    note: Note | null;
}

interface OutlineItem {
    id: string;
    level: number;
    text: string;
}

const getOutlineFromDoc = (doc: any): OutlineItem[] => {
    const headings: OutlineItem[] = [];
    if (!doc) return headings;

    // Handle nested 'doc' structure or direct node
    const root = doc.type === 'doc' ? doc : (doc.doc || doc);
    
    // Safety check if root is still not a valid node with content
    if (!root || !Array.isArray(root.content)) return headings;

    const traverse = (node: any) => {
        if (node.type === 'heading') {
            // Extract text from content array
            let text = "";
            if (node.content && Array.isArray(node.content)) {
                node.content.forEach((c: any) => {
                    if (c.text) text += c.text;
                });
            }
            
            // Only add if we have an ID (HeadingId extension ensures this, but safe guard)
            // or fallback to index based if no ID? For now rely on ID.
            if (node.attrs && node.attrs.id) {
                headings.push({
                    id: node.attrs.id,
                    level: node.attrs.level,
                    text: text || "Untitled Section"
                });
            } else if (node.attrs) {
                 // Fallback for headings without ID (legacy or race condition)
                 // We won't be able to scroll reliably without ID, so maybe skip or use random?
                 // Let's generate a temporary one to at least show it, but scrolling might fail.
                 headings.push({
                    id: 'missing-id',
                    level: node.attrs.level,
                    text: text || "Untitled Section"
                });
            }
        }
        
        // Recursive traversal (though headings are usually top-level blocks in standard schema)
        // Some schemas allow headings in blockquotes etc.
        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(traverse);
        }
    };

    traverse(root);
    return headings;
};

const OutlineWidget: React.FC<OutlineWidgetProps> = ({ note }) => {
    // Memoize outline computation to avoid excessive processing on unrelated renders
    const headings = useMemo(() => {
        if (!note || !note.content) return [];
        return getOutlineFromDoc(note.content);
    }, [note?.content, note?.id]);

    if (!note) {
        return <div className="p-4 text-center text-xs text-muted italic">No active note.</div>;
    }

    if (headings.length === 0) {
        return <div className="p-4 text-center text-xs text-muted italic">No headings found.</div>;
    }

    const handleScroll = (headingId: string) => {
        if (headingId === 'missing-id') return;
        const event = new CustomEvent('scroll-to-heading', { 
            detail: { noteId: note.id, headingId } 
        });
        window.dispatchEvent(event);
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto p-2">
            {headings.map((h, i) => (
                <button
                    key={`${h.id}-${i}`}
                    onClick={() => handleScroll(h.id)}
                    className="text-left px-2 py-1.5 text-xs text-muted hover:text-accent hover:bg-surface rounded transition-colors truncate flex items-center gap-2 group"
                    style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                    title={h.text}
                >
                    <span className="opacity-30 group-hover:opacity-50 font-mono text-[10px] w-4 text-right flex-shrink-0">H{h.level}</span>
                    <span className="truncate">{h.text}</span>
                </button>
            ))}
        </div>
    );
};

export default OutlineWidget;
