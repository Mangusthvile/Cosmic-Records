import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Note, NoteStatus, Workspace, Folder, NoteTypeDefinition, CharacterState, NoteType, CharacterForm, CharacterSnapshot } from '../types';
import { RefreshCw, ChevronDown, ChevronRight, Loader, Eye, Box, Search, ArrowUp, ArrowDown, X, Folder as FolderIcon, AlertTriangle, Layers, Plus, Camera, Archive } from 'lucide-react';
import { getUniqueTitle, moveNote, resolveNote } from '../services/storageService';
import HybridEditor, { HybridEditorHandle } from './editor/HybridEditor';
import { vaultService, noteContentToPlainText } from '../services/vaultService';
import { Input, Select, Badge, IconButton, Button } from './ui/Primitives';
import InterviewView from './views/InterviewView';

interface NoteEditorProps {
  note: Note; 
  workspace: Workspace;
  onUpdate: (updatedNote: Note, updatedWorkspace?: Workspace) => void;
  onGenerateTitle: () => void;
  readMode: boolean;
  onToggleReadMode: (enabled: boolean) => void;
  onOpenNote?: (id: string) => void;
  isFocusedPane?: boolean; 
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note: initialMeta, workspace, onUpdate, readMode, onToggleReadMode, onOpenNote, isFocusedPane }) => {
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [bodyLoaded, setBodyLoaded] = useState(false);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchState, setSearchState] = useState({ index: 0, count: 0 });
  const editorRef = useRef<HybridEditorHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localMeta, setLocalMeta] = useState<Note>(initialMeta);
  const [localContent, setLocalContent] = useState<any>(initialMeta.content); 
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // Character State
  const characterState = localMeta.metadata?.characterState as CharacterState | undefined;
  const activeFormId = characterState?.activeFormId || 'base';

  useEffect(() => {
      let isMounted = true;
      const loadBody = async () => {
          if (isFirstLoad.current) {
              const fullContent = await vaultService.ensureNoteContent(initialMeta.id);
              if (isMounted) { setLocalContent(fullContent); setBodyLoaded(true); }
              isFirstLoad.current = false;
          }
      };
      loadBody();
      return () => { isMounted = false; };
  }, [initialMeta.id]);

  useEffect(() => {
      if (initialMeta.updatedAt !== localMeta.updatedAt || initialMeta.id !== localMeta.id) {
           setLocalMeta(initialMeta);
           if (initialMeta.id !== localMeta.id) { setBodyLoaded(false); isFirstLoad.current = true; setIsFindOpen(false); setSearchQuery(''); }
      }
  }, [initialMeta]);

  const performSave = useCallback(async (noteState: Note, contentState: any) => {
      if (!contentState || (typeof contentState === 'object' && !contentState.type && !contentState.doc)) {
          console.warn("Prevented saving invalid content");
          return;
      }
      setSaveStatus('saving');
      onUpdate({ ...noteState, content: contentState, updatedAt: Date.now() }); 
      setSaveStatus('saved');
  }, [onUpdate]);

  const scheduleSave = (newMeta: Note, newContent: any) => {
      setSaveStatus('unsaved');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => { performSave(newMeta, newContent); }, 1000); 
  };

  const handleManualSave = () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); performSave(localMeta, localContent); };
  
  // Autosave on unmount/blur implicitly via cleanup? No, explicit save before unload is safer.
  // We rely on React state, but adding a listener for window unload might help.
  useEffect(() => {
      const handleBeforeUnload = () => {
          if (saveStatus === 'unsaved') performSave(localMeta, localContent);
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
          // Also save on component unmount if unsaved
          if (saveStatus === 'unsaved') performSave(localMeta, localContent); 
      };
  }, [saveStatus, localMeta, localContent, performSave]);

  const handleContentChange = (newDoc: any) => { setLocalContent(newDoc); scheduleSave(localMeta, newDoc); };
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => { const newMeta = { ...localMeta, title: e.target.value }; setLocalMeta(newMeta); scheduleSave(newMeta, localContent); };
  
  const handleTitleBlur = () => {
      let title = localMeta.title.trim();
      if (!title) {
          const plainText = noteContentToPlainText({ content: localContent });
          title = plainText.split('\n')[0]?.trim().substring(0, 40) || "Untitled Record";
      }
      const uniqueTitle = getUniqueTitle(workspace, title, localMeta.id);
      if (uniqueTitle !== localMeta.title) {
          const newMeta = { ...localMeta, title: uniqueTitle };
          setLocalMeta(newMeta);
          performSave(newMeta, localContent);
      }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => { const newMeta = { ...localMeta, status: e.target.value as NoteStatus }; setLocalMeta(newMeta); performSave(newMeta, localContent); };
  
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => { 
      const newMeta = { ...localMeta, type: e.target.value as NoteType }; 
      setLocalMeta(newMeta); 
      performSave(newMeta, localContent); 
  };
  
  const handleUniverseChange = (e: React.ChangeEvent<HTMLSelectElement>) => { const val = e.target.value; const newMeta = { ...localMeta, universeTag: val === 'none' ? null : val }; setLocalMeta(newMeta); performSave(newMeta, localContent); };
  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => { const newFolderId = e.target.value; if (newFolderId !== localMeta.folderId) { moveNote(workspace, localMeta.id, newFolderId); onUpdate({ ...localMeta, folderId: newFolderId }); } };
  
  const handleResolve = () => { if (confirm("Mark this note as resolved?")) { const newWorkspace = resolveNote(workspace, localMeta.id); onUpdate(newWorkspace.notes[localMeta.id], newWorkspace); } };

  const handleFormChange = (formId: string) => {
      if (!characterState) return;
      const newState = { ...characterState, activeFormId: formId };
      const newMeta = { ...localMeta, metadata: { ...localMeta.metadata, characterState: newState } };
      setLocalMeta(newMeta);
      performSave(newMeta, localContent);
  };

  const handleCreateForm = () => {
      const name = prompt("Name for new form (e.g. 'Ascended'):");
      if (!name) return;
      if (!characterState) return;
      const newForm: CharacterForm = { 
          formId: crypto.randomUUID(), 
          name, 
          createdAt: Date.now(),
          updatedAt: Date.now(),
          overrides: {}, 
          localBlocks: [] 
      };
      const newState = { ...characterState, forms: [...characterState.forms, newForm], activeFormId: newForm.formId };
      const newMeta = { ...localMeta, metadata: { ...localMeta.metadata, characterState: newState } };
      setLocalMeta(newMeta);
      performSave(newMeta, localContent);
  };

  const handleUpdateFormOverride = (moduleId: string, data: any) => {
      if (!characterState || activeFormId === 'base') return;
      
      const forms = [...characterState.forms];
      const formIndex = forms.findIndex(f => f.formId === activeFormId);
      if (formIndex === -1) return;

      const currentForm = forms[formIndex];
      const newOverrides = { ...currentForm.overrides };
      
      if (data === undefined) {
          delete newOverrides[moduleId];
      } else {
          newOverrides[moduleId] = data;
      }

      forms[formIndex] = { ...currentForm, overrides: newOverrides };
      const newState = { ...characterState, forms };
      const newMeta = { ...localMeta, metadata: { ...localMeta.metadata, characterState: newState } };
      setLocalMeta(newMeta);
      scheduleSave(newMeta, localContent); 
  };

  const handleCreateSnapshot = () => {
      if (!characterState) return;
      const label = prompt("Snapshot Label (e.g. 'End of Arc 1'):");
      if (!label) return;
      
      // Legacy snapshot creation in NoteEditor is limited. 
      const snapshot: CharacterSnapshot = {
          snapshotId: crypto.randomUUID(),
          label,
          date: new Date().toLocaleDateString(),
          createdAt: Date.now(),
          formId: activeFormId,
          resolved: {
              templateId: localMeta.templateId || 'default',
              blocks: [] 
          }
      };
      
      const newState = { ...characterState, snapshots: [...characterState.snapshots, snapshot] };
      const newMeta = { ...localMeta, metadata: { ...localMeta.metadata, characterState: newState } };
      setLocalMeta(newMeta);
      performSave(newMeta, localContent);
  };

  useEffect(() => {
      const handleAppCommand = (e: CustomEvent) => {
          if (isFocusedPane === false) return; 
          const { command } = e.detail;
          switch (command) {
              case 'note.save': handleManualSave(); break;
              case 'editor.find': setIsFindOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); break;
              case 'editor.findNext': if (isFindOpen) editorRef.current?.findNext(); break;
              case 'editor.findPrev': if (isFindOpen) editorRef.current?.findPrevious(); break;
          }
      };
      window.addEventListener('app-command', handleAppCommand as any);
      return () => window.removeEventListener('app-command', handleAppCommand as any);
  }, [isFocusedPane, isFindOpen, handleManualSave]);

  const handleSearchChange = (val: string) => { setSearchQuery(val); editorRef.current?.setSearchTerm(val); };
  const closeSearch = () => { setIsFindOpen(false); setSearchQuery(''); editorRef.current?.clearSearch(); };

  if (localMeta.aiInterview?.isActive) {
      return (
          <InterviewView 
              note={localMeta} 
              workspace={workspace} 
              onUpdate={onUpdate}
              onComplete={() => {}}
          />
      );
  }

  return (
    <div className="flex flex-col h-full text-text overflow-hidden relative group/editor bg-deep-space transition-colors duration-500">
      
      {/* 1. HEADER */}
      <div className="border-b border-border bg-panel z-20 flex-shrink-0 relative">
          
          {isFindOpen && (
              <div className="absolute inset-x-0 bottom-0 top-0 bg-panel z-30 flex items-center px-4 gap-2 border-b border-accent/50 animate-in slide-in-from-top-2 duration-100">
                  <Search size={14} className="text-accent" />
                  <Input ref={searchInputRef} className="h-7 w-[200px]" placeholder="Find..." value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? editorRef.current?.findPrevious() : editorRef.current?.findNext(); } if (e.key === 'Escape') closeSearch(); }} />
                  <span className="text-xs font-mono text-text2 min-w-[40px]">{searchState.count > 0 ? `${searchState.index + 1}/${searchState.count}` : '0/0'}</span>
                  <div className="h-4 w-[1px] bg-border mx-1"></div>
                  <IconButton size="sm" onClick={() => editorRef.current?.findPrevious()}><ArrowUp size={14}/></IconButton>
                  <IconButton size="sm" onClick={() => editorRef.current?.findNext()}><ArrowDown size={14}/></IconButton>
                  <IconButton size="sm" onClick={closeSearch} className="ml-2 hover:text-danger"><X size={14}/></IconButton>
              </div>
          )}

          <div className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-panel2 transition-colors select-none" onClick={() => setIsHeaderOpen(!isHeaderOpen)}>
              <div className="flex items-center gap-2 text-xs font-bold text-text2 uppercase tracking-widest">
                  {isHeaderOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>} Properties
              </div>
              <div className="flex items-center gap-3">
                  {characterState && (
                      <div className="flex items-center gap-2 bg-panel2 rounded px-2 py-0.5 border border-border" onClick={e => e.stopPropagation()}>
                          <Layers size={12} className="text-accent" />
                          <select 
                            className="bg-transparent text-[10px] font-bold uppercase text-text focus:outline-none"
                            value={activeFormId}
                            onChange={(e) => handleFormChange(e.target.value)}
                          >
                              <option value="base">Base Form</option>
                              {characterState.forms.map(f => <option key={f.formId} value={f.formId}>{f.name}</option>)}
                          </select>
                          <IconButton size="sm" className="h-4 w-4" onClick={handleCreateForm}><Plus size={10} /></IconButton>
                      </div>
                  )}
                  {localMeta.unresolved && (
                      <div className="flex items-center gap-2">
                          <Badge variant="danger">UNRESOLVED</Badge>
                          <button onClick={(e) => { e.stopPropagation(); handleResolve(); }} className="text-[10px] text-danger underline hover:text-text">Resolve</button>
                      </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleManualSave(); }} className={`text-[10px] font-mono flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${saveStatus === 'unsaved' ? 'text-warning border-warning/30 bg-warning/10' : saveStatus === 'saving' ? 'text-accent border-accent/30' : 'text-text2 border-transparent hover:border-border'}`}>
                      {saveStatus === 'saving' && <RefreshCw size={10} className="animate-spin" />}
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? 'Unsaved' : 'Saved'}
                  </button>
              </div>
          </div>
          
          {isHeaderOpen && (
              <div className="px-4 pb-4 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-[10px] uppercase text-text2 font-bold">Title</label>
                      <Input value={localMeta.title} onChange={handleTitleChange} onBlur={handleTitleBlur} className={localMeta.unresolved ? 'border-danger text-danger' : ''} />
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-text2 font-bold">Status</label>
                      <Select value={localMeta.status} onChange={handleStatusChange}>
                          <option value="Draft">Draft</option>
                          <option value="Canon">Canon</option>
                          <option value="Experimental">Experimental</option>
                          <option value="Outdated">Outdated</option>
                          <option value="Archived">Archived</option>
                      </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-text2 font-bold">Type</label>
                      <Select value={localMeta.type} onChange={handleTypeChange}>
                          {/* Force lowercase matching with new type system */}
                          {workspace.templates.noteTypes.map(t => <option key={t.typeId} value={t.typeId}>{t.name}</option>)}
                      </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-text2 font-bold">Universe</label>
                      <Select value={localMeta.universeTag || 'none'} onChange={handleUniverseChange}>
                          <option value="none">None (Cosmos)</option>
                          {workspace.settings.universeTags.tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                      </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-text2 font-bold">Folder</label>
                      <div className="relative">
                          <Select value={localMeta.folderId} onChange={handleFolderChange} className="pl-7">
                              {(Object.values(workspace.folders) as Folder[]).filter(f=>f.type==='user'||f.id==='inbox').sort((a,b)=>a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </Select>
                          <FolderIcon size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text2 pointer-events-none" />
                      </div>
                  </div>
                  {characterState && (
                      <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase text-text2 font-bold">Snapshots</label>
                          <div className="flex gap-2">
                              <Button size="sm" onClick={handleCreateSnapshot} className="w-full flex gap-1 justify-center"><Camera size={12} /> Capture</Button>
                              {characterState.snapshots.length > 0 && <Badge>{characterState.snapshots.length}</Badge>}
                          </div>
                      </div>
                  )}
                  <div className="col-span-full flex items-center gap-4 mt-1 pt-2 border-t border-border/50 text-[10px] text-text2 font-mono">
                      <span>Created: {new Date(localMeta.createdAt).toLocaleDateString()}</span>
                      <span>Updated: {new Date(localMeta.updatedAt).toLocaleString()}</span>
                      <span>ID: {localMeta.id.split('-')[0]}</span>
                  </div>
              </div>
          )}
      </div>

      <div className="flex-1 overflow-hidden relative bg-deep-space">
         {!bodyLoaded ? (
             <div className="absolute inset-0 flex items-center justify-center text-text2 gap-2">
                 <Loader size={16} className="animate-spin" />
                 <span className="text-xs font-mono">Loading Body...</span>
             </div>
         ) : (
             <HybridEditor 
                ref={editorRef} 
                doc={localContent} 
                noteId={localMeta.id} 
                onDocChange={handleContentChange} 
                readOnly={readMode} 
                workspace={workspace} 
                onOpenNote={onOpenNote || ((id)=>console.log(id))} 
                onSearchStateChange={setSearchState}
                activeFormId={activeFormId}
                forms={characterState?.forms}
                onUpdateFormOverride={handleUpdateFormOverride}
             />
         )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-panel/90 backdrop-blur-md border border-border px-4 py-2 rounded-full shadow-soft flex items-center gap-1 z-20">
          <button onClick={() => { performSave(localMeta, localContent); onToggleReadMode(!readMode); }} className={`p-2 hover:bg-panel2 rounded-full transition-colors flex items-center gap-2 ${readMode ? 'text-accent' : 'text-text2 hover:text-text'}`}>
              {readMode ? <Eye size={18}/> : <Box size={18}/>}
              <span className="text-xs font-bold">{readMode ? 'Reader' : 'Editor'}</span>
          </button>
      </div>
    </div>
  );
};

export default NoteEditor;