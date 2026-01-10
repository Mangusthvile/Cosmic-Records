
import React from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Strikethrough, Highlighter, AlignLeft, AlignCenter, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code, SeparatorHorizontal, Table as TableIcon, Image as ImageIcon, FunctionSquare, ChevronRight, RemoveFormatting, Undo, Redo, Link as LinkIcon } from 'lucide-react';
import { vaultService } from '../../services/vaultService';
import { IconButton } from '../ui/Primitives';

interface MenuBarProps { editor: Editor | null; noteId: string; }

const MenuBar: React.FC<MenuBarProps> = ({ editor, noteId }) => {
    if (!editor) return null;
    const isActive = (nameOrAttrs: string | Record<string, any>, opts?: any) => editor.isActive(nameOrAttrs as any, opts) ? 'primary' : 'ghost';

    const insertImage = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = async () => {
            if (input.files && input.files[0]) {
                try {
                    const path = await vaultService.saveAttachment(noteId, input.files[0]);
                    const blobUrl = await vaultService.getAttachmentUrl(path);
                    if (blobUrl) editor.chain().focus().setImage({ src: blobUrl, title: path }).run();
                } catch (e) { console.error("Upload failed", e); }
            }
        };
        input.click();
    };

    const insertLink = () => { const title = prompt("Enter note title to link:"); if (title) editor.chain().focus().insertContent(`[[${title}]] `).run(); };
    const addTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    const addToggle = () => editor.chain().focus().insertContent({ type: 'collapsibleBlock', content: [{ type: 'collapsibleSummary', content: [{ type: 'text', text: 'Toggle' }] }, { type: 'collapsibleContent', content: [{ type: 'paragraph' }] }] }).run();
    const addMath = () => editor.chain().focus().insertContent({ type: 'mathBlock' }).run();

    return (
        <div className="flex items-center gap-1 p-2 border-b border-border bg-panel overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-0.5 pr-2 border-r border-border/50">
                <IconButton size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo size={14} /></IconButton>
            </div>
            <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleBold().run()} variant={isActive('bold') as any}><Bold size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} variant={isActive('italic') as any}><Italic size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} variant={isActive('underline') as any}><Underline size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} variant={isActive('strike') as any}><Strikethrough size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleHighlight().run()} variant={isActive('highlight') as any}><Highlighter size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().unsetAllMarks().run()} variant="danger"><RemoveFormatting size={14} /></IconButton>
            </div>
            <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} variant={isActive('heading', { level: 1 }) as any}><Heading1 size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} variant={isActive('heading', { level: 2 }) as any}><Heading2 size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} variant={isActive('heading', { level: 3 }) as any}><Heading3 size={14} /></IconButton>
            </div>
            <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} variant={isActive('bulletList') as any}><List size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} variant={isActive('orderedList') as any}><ListOrdered size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleTaskList().run()} variant={isActive('taskList') as any}><CheckSquare size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleBlockquote().run()} variant={isActive('blockquote') as any}><Quote size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().toggleCodeBlock().run()} variant={isActive('codeBlock') as any}><Code size={14} /></IconButton>
            </div>
            <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
                <IconButton size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} variant={isActive({ textAlign: 'left' }) as any}><AlignLeft size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} variant={isActive({ textAlign: 'center' }) as any}><AlignCenter size={14} /></IconButton>
            </div>
            <div className="flex items-center gap-0.5 px-2">
                <IconButton size="sm" onClick={insertLink}><LinkIcon size={14} /></IconButton>
                <IconButton size="sm" onClick={addTable}><TableIcon size={14} /></IconButton>
                <IconButton size="sm" onClick={insertImage}><ImageIcon size={14} /></IconButton>
                <IconButton size="sm" onClick={addToggle}><ChevronRight size={14} /></IconButton>
                <IconButton size="sm" onClick={addMath}><FunctionSquare size={14} /></IconButton>
                <IconButton size="sm" onClick={() => editor.chain().focus().setHorizontalRule().run()}><SeparatorHorizontal size={14} /></IconButton>
            </div>
        </div>
    );
};
export default MenuBar;
