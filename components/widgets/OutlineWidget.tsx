import React from 'react';
import { Note } from '../../types';
import { AlignLeft, Hash } from 'lucide-react';

interface OutlineWidgetProps {
    note: Note | null;
}

const OutlineWidget: React.FC<OutlineWidgetProps> = ({ note }) => {
    if (!note) {
        return <div className="p-4 text-center text-xs text-muted italic">No active note.</div>;
    }

    const lines = note.content ? note.content.split('\n') : [];
    const headings = lines
        .map((line, index) => {
            const match = line.match(/^(#{1,3})\s+(.*)/);
            if (!match) return null;
            return {
                level: match[1].length,
                text: match[2],
                index
            };
        })
        .filter((h): h is { level: number, text: string, index: number } => !!h);

    const handleScroll = (text: string) => {
        // Dispatch event for NoteEditor
        const event = new CustomEvent('scroll-to-heading', { detail: { text } });
        window.dispatchEvent(event);
    };

    if (headings.length === 0) {
        return <div className="p-4 text-center text-xs text-muted italic">No headings found.</div>;
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto p-2">
            {headings.map((h, i) => (
                <button
                    key={i}
                    onClick={() => handleScroll(h.text)}
                    className="text-left px-2 py-1.5 text-xs text-muted hover:text-accent hover:bg-surface rounded transition-colors truncate"
                    style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                    title={h.text}
                >
                    <span className="opacity-50 mr-2 font-mono">{Array(h.level).fill('#').join('')}</span>
                    {h.text}
                </button>
            ))}
        </div>
    );
};

export default OutlineWidget;