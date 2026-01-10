
import React, { useState, useEffect } from 'react';
import { Workspace, NoteTypeDefinition, NoteStatus, Folder } from '../types';
import { FileText, User, Map, Box, Calendar, Scroll, Sparkles, PenTool, X, ChevronRight, Layout } from 'lucide-react';
import { vaultService } from '../services/vaultService';
import { Panel, Button, IconButton, Input, Select } from './ui/Primitives';

interface NoteCreationModalProps { isOpen: boolean; onClose: () => void; onCreate: (options: any) => void; workspace: Workspace; }
const getIcon = (iconName: string | undefined) => {
    switch(iconName) { case 'User': return User; case 'Map': return Map; case 'Box': return Box; case 'Calendar': return Calendar; case 'Scroll': return Scroll; case 'Layout': return Layout; default: return FileText; }
};

const NoteCreationModal: React.FC<NoteCreationModalProps> = ({ isOpen, onClose, onCreate, workspace }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [typeId, setTypeId] = useState<string>('General');
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState<NoteStatus>('Draft');
    const [folderId, setFolderId] = useState<string>('inbox');
    const [universeTag, setUniverseTag] = useState<string>('none');
    const [method, setMethod] = useState<'blank' | 'ai'>('blank');
    const noteTypes: NoteTypeDefinition[] = workspace?.templates.noteTypes || [];
    const sortedFolders = (Object.values(workspace.folders) as Folder[]).sort((a, b) => a.name.localeCompare(b.name));

    useEffect(() => {
        if (isOpen) {
            setStep(1); setTitle(''); setStatus('Draft'); setFolderId('inbox'); setUniverseTag('none'); setMethod('blank');
            if (workspace?.templates.lastUsed?.typeId) setTypeId(workspace.templates.lastUsed.typeId);
        }
    }, [isOpen, workspace]);

    const handleConfirm = () => {
        const newTemplates = { ...workspace.templates, lastUsed: { typeId }, updatedAt: Date.now() };
        workspace.templates = newTemplates; vaultService.debouncedSaveTemplates(newTemplates);
        onCreate({ title: title.trim(), type: typeId, status, folderId, universeTag: universeTag === 'none' ? null : universeTag, method });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <Panel className="w-[600px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] rounded-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-panel">
                    <div>
                        <h2 className="text-lg font-bold text-text">Create New Record</h2>
                        <div className="flex items-center gap-2 text-xs text-text2 mt-1">
                            <span className={step === 1 ? 'text-accent font-bold' : ''}>1. Type</span><ChevronRight size={12} /><span className={step === 2 ? 'text-accent font-bold' : ''}>2. Configure</span>
                        </div>
                    </div>
                    <IconButton onClick={onClose}><X size={20} /></IconButton>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-panel2">
                    {step === 1 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {noteTypes.map((t) => {
                                const Icon = getIcon(t.icon);
                                const isSelected = typeId === t.typeId;
                                return (
                                    <button key={t.typeId} onClick={() => setTypeId(t.typeId)} className={`flex flex-col gap-2 p-4 rounded-lg border text-left transition-all ${isSelected ? 'bg-accent/10 border-accent shadow-glow' : 'bg-panel border-border hover:border-accent/50 hover:bg-panel'}`}>
                                        <div className="flex items-center gap-2"><Icon size={18} className={isSelected ? 'text-accent' : 'text-text2'} /><span className={`font-bold ${isSelected ? 'text-text' : 'text-text2'}`}>{t.name}</span></div>
                                        <p className="text-[10px] text-text2 line-clamp-2">{t.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setMethod('blank')} className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${method === 'blank' ? 'bg-accent/10 border-accent' : 'bg-panel border-border opacity-60 hover:opacity-100'}`}>
                                    <PenTool size={20} className={method === 'blank' ? 'text-accent' : 'text-text2'} />
                                    <div className="text-left"><div className="text-sm font-bold text-text">Blank Note</div><div className="text-[10px] text-text2">Empty record</div></div>
                                </button>
                                <button onClick={() => setMethod('ai')} className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${method === 'ai' ? 'bg-purple-500/10 border-purple-500' : 'bg-panel border-border opacity-60 hover:opacity-100'}`}>
                                    <Sparkles size={20} className={method === 'ai' ? 'text-purple-400' : 'text-text2'} />
                                    <div className="text-left"><div className="text-sm font-bold text-text">AI Interview</div><div className="text-[10px] text-text2">Guided creation</div></div>
                                </button>
                            </div>
                            <hr className="border-border" />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-text2 uppercase mb-1 block">Title</label>
                                    <Input placeholder="Enter title..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text2 uppercase mb-1 block">Folder</label>
                                    <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                                        {sortedFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text2 uppercase mb-1 block">Universe</label>
                                    <Select value={universeTag} onChange={(e) => setUniverseTag(e.target.value)}>
                                        <option value="none">None (Cosmos)</option>
                                        {workspace.settings.universeTags.tags.map(t => <option key={t} value={t}>{t}</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text2 uppercase mb-1 block">Status</label>
                                    <Select value={status} onChange={(e) => setStatus(e.target.value as NoteStatus)}>
                                        <option value="Draft">Draft</option><option value="Canon">Canon</option><option value="Experimental">Experimental</option><option value="Outdated">Outdated</option>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-border bg-panel flex justify-between items-center">
                    {step === 2 ? <Button variant="ghost" onClick={() => setStep(1)} size="sm">Back</Button> : <div />}
                    {step === 1 ? <Button onClick={() => setStep(2)}>Next Step</Button> : <Button onClick={handleConfirm}>Create Note</Button>}
                </div>
            </Panel>
        </div>
    );
};
export default NoteCreationModal;
