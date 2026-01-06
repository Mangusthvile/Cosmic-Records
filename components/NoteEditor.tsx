import React, { useState, useEffect, useRef } from 'react';
import { Note, NoteType, NoteStatus, Workspace, UniverseTag } from '../types';
import { Save, RefreshCw, Volume2, Plus, Box, Hash, Clock, CheckCircle, AlertTriangle, XCircle, Beaker, Bold, Italic, Link as LinkIcon, List, Image as ImageIcon, MoreHorizontal, LayoutTemplate, Loader, Globe, AlertOctagon, ChevronDown, ChevronRight, Archive, Sparkles, Folder } from 'lucide-react';
import { parseLinksAndUpdateWorkspace } from '../services/storageService';
import { parseWikiLinks, Token } from '../services/linkService';
import { generateTitle, generateNoteCover } from '../services/geminiService';

interface NoteEditorProps {
  note: Note;
  workspace: Workspace;
  onUpdate: (updatedNote: Note, updatedWorkspace?: Workspace) => void;
  onGenerateTitle: () => void;
  readMode: boolean;
  onToggleReadMode: (enabled: boolean) => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note, workspace, onUpdate, onGenerateTitle, readMode, onToggleReadMode }) => {
  // We use local state for the header fields, but content is uncontrolled in textarea for undo support
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Debounce Timer
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When note ID changes, we must reset the textarea value manually if we are reusing the component
  // Using key={note.id} in parent is safer, but if not, this effect helps.
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.value = note.content || "";
    }
  }, [note.id]);

  // Scroll to heading listener
  useEffect(() => {
      const handleScrollToHeading = (e: any) => {
          const text = e.detail?.text;
          if (text && textareaRef.current && !readMode) {
              const value = textareaRef.current.value;
              const index = value.indexOf(text);
              if (index >= 0) {
                  textareaRef.current.focus();
                  textareaRef.current.setSelectionRange(index, index);
                  const lineHeight = 24; 
                  const lines = value.substring(0, index).split('\n').length;
                  textareaRef.current.scrollTop = lines * lineHeight - 100;
              }
          }
      };
      window.addEventListener('scroll-to-heading', handleScrollToHeading);
      return () => window.removeEventListener('scroll-to-heading', handleScrollToHeading);
  }, [readMode]);

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const val = e.currentTarget.value;
      setSaveStatus('unsaved');
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(() => {
          setSaveStatus('saving');
          // We must update the workspace model
          // Note: parseLinksAndUpdateWorkspace calculates side effects (backlinks, etc)
          const updatedWorkspace = parseLinksAndUpdateWorkspace(workspace, note.id, val);
          const updatedNote = updatedWorkspace.notes[note.id];
          onUpdate(updatedNote, updatedWorkspace);
          setSaveStatus('saved');
      }, 800);
  };

  const handleManualSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!textareaRef.current) return;
    
    setSaveStatus('saving');
    const val = textareaRef.current.value;
    const updatedWorkspace = parseLinksAndUpdateWorkspace(workspace, note.id, val);
    const updatedNote = updatedWorkspace.notes[note.id];
    onUpdate(updatedNote, updatedWorkspace);
    setSaveStatus('saved');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...note, title: e.target.value });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate({ ...note, status: e.target.value as NoteStatus });
  };
  
  const handleUniverseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      onUpdate({ ...note, universeTag: val === 'none' ? null : val });
  };

  // --- AI Interview Stub ---
  const handleStartInterview = () => {
      onUpdate({ 
          ...note, 
          aiInterview: { ...note.aiInterview!, isActive: true, step: 'interview', transcript: [] } 
      });
  };

  const handleGenerateDraft = () => {
      const stubContent = `# ${note.title}\n\n**Type:** ${note.type}\n\n## Overview\n[AI Generated Description Stub]\n\n## Traits\n- Trait 1\n- Trait 2\n`;
      if (textareaRef.current) textareaRef.current.value = stubContent;
      // Trigger save immediately
      const updatedWorkspace = parseLinksAndUpdateWorkspace(workspace, note.id, stubContent);
      onUpdate({ ...updatedWorkspace.notes[note.id], aiInterview: undefined }, updatedWorkspace);
  };

  const renderContent = (content: string) => {
      const tokens = parseWikiLinks(content);
      return (
          <div className="whitespace-pre-wrap leading-relaxed">
              {tokens.map((token, idx) => {
                  if (token.kind === 'text') return <span key={idx}>{token.value}</span>;
                  
                  const targetId = workspace.indexes.title_to_note_id[token.title];
                  const exists = !!targetId;
                  
                  return (
                      <span 
                        key={idx}
                        onClick={() => {
                             const event = new CustomEvent('open-note', { detail: { title: token.title } });
                             window.dispatchEvent(event);
                        }}
                        className={`
                            font-bold underline cursor-pointer transition-colors
                            ${exists ? 'text-accent hover:text-accent-glow' : 'text-danger hover:text-red-300 decoration-dashed'}
                        `}
                        title={exists ? `Open ${token.title}` : `Unresolved: ${token.title}`}
                      >
                          {token.display || token.title}
                      </span>
                  );
              })}
          </div>
      );
  };

  const renderAIPlaceholder = () => (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-4">
              <Sparkles size={32} />
          </div>
          <h2 className="text-2xl font-bold text-foreground">AI Guided Creation</h2>
          <p className="text-muted max-w-md">
              You are creating a new <span className="text-accent font-bold">{note.type}</span> record. 
              The assistant will interview you to build the initial draft.
          </p>
          
          {note.aiInterview?.step === 'start' && (
              <button onClick={handleStartInterview} className="bg-accent text-white px-6 py-2 rounded-md font-bold hover:opacity-90 transition-opacity">
                  Start Interview
              </button>
          )}

          {note.aiInterview?.step === 'interview' && (
              <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full space-y-4">
                  <div className="text-sm text-muted italic">Assistant is thinking... (Stub)</div>
                  <button onClick={handleGenerateDraft} className="w-full bg-purple-500 text-white px-4 py-2 rounded font-bold hover:bg-purple-600">
                      Generate Draft (Stub)
                  </button>
              </div>
          )}
      </div>
  );

  if (note.aiInterview) {
      return (
          <div className="flex flex-col h-full bg-deep-space relative overflow-hidden">
             {renderAIPlaceholder()}
          </div>
      );
  }

  const createdDate = new Date(note.createdAt).toLocaleDateString();
  const updatedDate = new Date(note.updatedAt).toLocaleString();

  return (
    <div className="flex flex-col h-full text-foreground overflow-hidden relative group/editor bg-deep-space transition-colors duration-500">
      
      {/* 1. PROPERTIES HEADER */}
      <div className="border-b border-chrome-border bg-chrome-panel z-20 flex-shrink-0">
          <div 
            className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-surface transition-colors select-none"
            onClick={() => setIsHeaderOpen(!isHeaderOpen)}
          >
              <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-widest">
                  {isHeaderOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                  Properties
              </div>
              <div className="text-[10px] font-mono text-faint">
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? 'Unsaved' : 'Saved'}
              </div>
          </div>
          
          {isHeaderOpen && (
              <div className="px-4 pb-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 animate-in slide-in-from-top-2 duration-200">
                  {/* Title */}
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-muted font-bold">Title</label>
                      <input 
                        className="bg-surface border border-border rounded px-2 py-1 text-sm focus:border-accent focus:outline-none"
                        value={note.title}
                        onChange={handleTitleChange}
                      />
                  </div>
                  {/* Status */}
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-muted font-bold">Status</label>
                      <select 
                        className="bg-surface border border-border rounded px-2 py-1 text-sm focus:border-accent focus:outline-none appearance-none"
                        value={note.status}
                        onChange={handleStatusChange}
                      >
                          <option value="Draft">Draft</option>
                          <option value="Canon">Canon</option>
                          <option value="Experimental">Experimental</option>
                          <option value="Outdated">Outdated</option>
                          <option value="Archived">Archived</option>
                      </select>
                  </div>
                  {/* Universe */}
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-muted font-bold">Universe</label>
                      <select 
                        className="bg-surface border border-border rounded px-2 py-1 text-sm focus:border-accent focus:outline-none appearance-none"
                        value={note.universeTag || 'none'}
                        onChange={handleUniverseChange}
                      >
                          <option value="none">None (Cosmos)</option>
                          {(Object.values(workspace.universe_tags) as UniverseTag[]).map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                      </select>
                  </div>
                  {/* Folder */}
                   <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-muted font-bold">Folder</label>
                      <div className="flex items-center gap-2 text-sm text-muted px-2 py-1 bg-surface/50 border border-transparent rounded cursor-not-allowed opacity-70">
                          <Folder size={12} />
                          {workspace.folders[note.folderId]?.name || 'Inbox'}
                      </div>
                  </div>
                  <div className="col-span-full flex items-center gap-4 mt-1 pt-2 border-t border-chrome-border/50 text-[10px] text-faint font-mono">
                      <span>Created: {createdDate}</span>
                      <span>Updated: {updatedDate}</span>
                      <span>ID: {note.id.split('-')[0]}</span>
                  </div>
              </div>
          )}
      </div>

      {/* 2. EDITOR AREA */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative">
         <div className="px-8 lg:px-16 py-8 min-h-full">
             {!readMode ? (
                <textarea 
                    key={note.id} // Critical for resetting undo stack between notes
                    ref={textareaRef}
                    className="w-full h-full min-h-[600px] bg-transparent resize-none focus:outline-none font-serif text-lg leading-relaxed text-foreground placeholder:text-muted/50"
                    defaultValue={note.content || ""}
                    onInput={handleInput}
                    placeholder="Start writing the canon..."
                    spellCheck={false}
                />
            ) : (
                <div className="prose prose-invert prose-lg max-w-none font-serif text-foreground leading-relaxed">
                    {note.content ? renderContent(note.content) : <span className="text-muted italic">Empty record.</span>}
                </div>
            )}
         </div>
      </div>

      {/* 3. FLOATING TOOLBAR */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-panel/80 backdrop-blur-md border border-border px-4 py-2 rounded-full shadow-2xl flex items-center gap-1 z-20">
          <button 
              onClick={() => { if(!readMode) handleManualSave(); onToggleReadMode(!readMode); }}
              className={`p-2 hover:bg-[var(--c-hover)] rounded-full transition-colors tooltip ${readMode ? 'text-accent' : 'text-muted hover:text-foreground'}`}
              title={readMode ? "Edit Mode" : "Preview Mode"}
          >
              {readMode ? <List size={18}/> : <Box size={18}/>}
          </button>
          <div className="w-[1px] h-4 bg-border mx-1"></div>
          <button onClick={handleManualSave} className="ml-2 bg-foreground text-background px-4 py-1.5 rounded-full text-xs font-bold hover:opacity-80 transition-opacity">
              {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </button>
      </div>

    </div>
  );
};

export default NoteEditor;