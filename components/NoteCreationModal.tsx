
import React, { useState, useEffect, useRef } from 'react';
import { Workspace, NoteTypeDefinition, NoteStatus, Folder, CharacterTemplate, InterviewQuestion } from '../types';
import { FileText, User, Map, Box, Calendar, Scroll, Sparkles, PenTool, X, ChevronRight, Layout, ArrowRight, ArrowLeft, Upload } from 'lucide-react';
import { vaultService } from '../services/vaultService';
import { Panel, Button, IconButton, Input, Select } from './ui/Primitives';
import { characterCreationService } from '../services/modularCreationService';
import { createNote, logNotification } from '../services/storageService';
import { importCharacterBundle } from '../services/modularExportService';

interface NoteCreationModalProps { isOpen: boolean; onClose: () => void; onCreate: (options: any) => void; workspace: Workspace; }
const getIcon = (iconName: string | undefined) => {
    switch(iconName) { case 'User': return User; case 'Map': return Map; case 'Box': return Box; case 'Calendar': return Calendar; case 'Scroll': return Scroll; case 'Layout': return Layout; default: return FileText; }
};

type WizardStep = 'TYPE_SELECT' | 'TEMPLATE_SELECT' | 'METHOD_SELECT' | 'INTERVIEW' | 'CONFIGURE';

const NoteCreationModal: React.FC<NoteCreationModalProps> = ({ isOpen, onClose, onCreate, workspace }) => {
    const [step, setStep] = useState<WizardStep>('TYPE_SELECT');
    const [typeId, setTypeId] = useState<string>('general');
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState<NoteStatus>('Draft');
    const [folderId, setFolderId] = useState<string>('inbox');
    const [universeTag, setUniverseTag] = useState<string>('none');
    
    // Character Flow State
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('character_default');
    const [creationMethod, setCreationMethod] = useState<'blank' | 'interview'>('blank');
    const [interviewAnswers, setInterviewAnswers] = useState<Record<string, any>>({});
    
    const noteTypes: NoteTypeDefinition[] = workspace?.templates.noteTypes || [];
    const sortedFolders = (Object.values(workspace.folders) as Folder[]).sort((a, b) => a.name.localeCompare(b.name));
    const templates = Object.values(workspace.characterTemplates) as CharacterTemplate[];
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setStep('TYPE_SELECT'); setTitle(''); setStatus('Draft'); setFolderId('inbox'); setUniverseTag('none');
            setInterviewAnswers({});
            if (workspace?.templates.lastUsed?.typeId) setTypeId(workspace.templates.lastUsed.typeId);
        }
    }, [isOpen, workspace]);

    const handleNext = () => {
        if (step === 'TYPE_SELECT') {
            // M7: Modular type (id 'modular') triggers template selection
            if (typeId === 'modular') {
                setStep('TEMPLATE_SELECT');
            } else {
                setStep('CONFIGURE');
            }
        } else if (step === 'TEMPLATE_SELECT') {
            setStep('METHOD_SELECT');
        } else if (step === 'METHOD_SELECT') {
            if (creationMethod === 'interview') {
                setStep('INTERVIEW');
            } else {
                // Blank -> Finish
                handleConfirm();
            }
        } else if (step === 'INTERVIEW') {
            // Finish
            handleConfirm();
        }
    };

    const handleBack = () => {
        if (step === 'CONFIGURE') setStep('TYPE_SELECT');
        else if (step === 'TEMPLATE_SELECT') setStep('TYPE_SELECT');
        else if (step === 'METHOD_SELECT') setStep('TEMPLATE_SELECT');
        else if (step === 'INTERVIEW') setStep('METHOD_SELECT');
    };

    const handleConfirm = () => {
        const newTemplates = { ...workspace.templates, lastUsed: { typeId }, updatedAt: Date.now() };
        workspace.templates = newTemplates; vaultService.debouncedSaveTemplates(newTemplates);

        if (typeId === 'modular') {
            // Use creation service which handles template application
            const note = characterCreationService.createCharacterNote(workspace, {
                title: title.trim() || undefined,
                folderId,
                universeTag: universeTag === 'none' ? null : universeTag,
                templateId: selectedTemplateId,
                method: creationMethod,
                answers: interviewAnswers
            });
            onCreate({ _preCreatedNote: note });
        } else {
            onCreate({ title: title.trim(), type: typeId, status, folderId, universeTag: universeTag === 'none' ? null : universeTag });
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            const note = await importCharacterBundle(file, workspace);
            if (note) {
                logNotification(workspace, 'success', `Imported character: ${note.title}`);
                onCreate({ _preCreatedNote: note });
            }
        } catch (err) {
            console.error(err);
            alert("Import failed. Check console.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const activeTemplate = workspace.characterTemplates[selectedTemplateId];

    const renderTypeSelect = () => (
        <div className="space-y-4">
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
            
            <div className="pt-2 border-t border-border flex justify-end">
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
                <Button size="sm" variant="outline" onClick={handleImportClick} className="gap-2">
                    <Upload size={14} /> Import from File...
                </Button>
            </div>
        </div>
    );

    const renderTemplateSelect = () => (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-text">Select Template</h3>
            <div className="grid grid-cols-1 gap-2">
                {templates.map(tpl => (
                    <button 
                        key={tpl.templateId}
                        onClick={() => setSelectedTemplateId(tpl.templateId)}
                        className={`flex flex-col p-3 rounded border text-left transition-colors ${selectedTemplateId === tpl.templateId ? 'bg-accent/10 border-accent' : 'bg-panel border-border hover:bg-panel2'}`}
                    >
                        <span className="text-sm font-bold text-text">{tpl.name}</span>
                        <span className="text-xs text-text2">{tpl.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderMethodSelect = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setCreationMethod('blank')} className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${creationMethod === 'blank' ? 'bg-accent/10 border-accent' : 'bg-panel border-border opacity-60 hover:opacity-100'}`}>
                    <PenTool size={20} className={creationMethod === 'blank' ? 'text-accent' : 'text-text2'} />
                    <div className="text-left"><div className="text-sm font-bold text-text">Blank</div><div className="text-[10px] text-text2">Start from scratch</div></div>
                </button>
                <button 
                    onClick={() => setCreationMethod('interview')} 
                    disabled={!activeTemplate?.interview}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${creationMethod === 'interview' ? 'bg-purple-500/10 border-purple-500' : 'bg-panel border-border opacity-60 hover:opacity-100'} ${!activeTemplate?.interview ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                    <Sparkles size={20} className={creationMethod === 'interview' ? 'text-purple-400' : 'text-text2'} />
                    <div className="text-left">
                        <div className="text-sm font-bold text-text">AI Created</div>
                        <div className="text-[10px] text-text2">{activeTemplate?.interview ? 'Guided Interview' : 'Not available for template'}</div>
                    </div>
                </button>
            </div>
            {creationMethod === 'interview' && (
                <div className="p-3 bg-panel2 rounded text-xs text-text2 border border-border">
                    <p>The AI will ask you questions to generate the character profile automatically.</p>
                </div>
            )}
        </div>
    );

    const renderInterview = () => {
        if (!activeTemplate?.interview) return null;
        return (
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-text mb-2">{activeTemplate.interview.title}</h3>
                <p className="text-xs text-text2 mb-4">{activeTemplate.interview.intro}</p>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeTemplate.interview.questions.map((q: InterviewQuestion) => (
                        <div key={q.id} className="space-y-1">
                            <label className="text-xs font-bold text-text">{q.prompt} {q.required && <span className="text-danger">*</span>}</label>
                            {q.type === 'longText' ? (
                                <textarea 
                                    className="w-full bg-panel2 border border-border rounded p-2 text-sm text-text focus:border-accent outline-none min-h-[80px]"
                                    value={interviewAnswers[q.id] || ''}
                                    onChange={(e) => setInterviewAnswers(prev => ({...prev, [q.id]: e.target.value}))}
                                />
                            ) : (
                                <Input 
                                    value={interviewAnswers[q.id] || ''}
                                    onChange={(e) => setInterviewAnswers(prev => ({...prev, [q.id]: e.target.value}))}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderConfigure = () => (
        <div className="space-y-4">
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
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <Panel className="w-[600px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] rounded-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-panel">
                    <div>
                        <h2 className="text-lg font-bold text-text">
                            {step === 'TYPE_SELECT' ? 'Create New Record' : 
                             step === 'TEMPLATE_SELECT' ? 'Choose Template' :
                             step === 'METHOD_SELECT' ? 'Creation Method' :
                             step === 'INTERVIEW' ? 'Character Interview' :
                             'Configure Record'}
                        </h2>
                    </div>
                    <IconButton onClick={onClose}><X size={20} /></IconButton>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 bg-panel2">
                    {step === 'TYPE_SELECT' && renderTypeSelect()}
                    {step === 'TEMPLATE_SELECT' && renderTemplateSelect()}
                    {step === 'METHOD_SELECT' && renderMethodSelect()}
                    {step === 'INTERVIEW' && renderInterview()}
                    {step === 'CONFIGURE' && renderConfigure()}
                </div>
                <div className="px-6 py-4 border-t border-border bg-panel flex justify-between items-center">
                    {step !== 'TYPE_SELECT' ? <Button variant="ghost" onClick={handleBack} size="sm">Back</Button> : <div />}
                    
                    {step === 'CONFIGURE' || (step === 'METHOD_SELECT' && creationMethod === 'blank') || step === 'INTERVIEW' ? (
                        <Button onClick={handleConfirm}>{step === 'INTERVIEW' ? 'Generate Character' : 'Create Note'}</Button>
                    ) : (
                        <Button onClick={handleNext}>Next <ArrowRight size={16} className="ml-1" /></Button>
                    )}
                </div>
            </Panel>
        </div>
    );
};
export default NoteCreationModal;
