
import React, { useState } from 'react';
import { Workspace, SettingsData, HotkeysData, KeyBinding } from '../types';
import { X, Monitor, Keyboard, Tag, Shield, Database, AlertTriangle, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { vaultService } from '../services/vaultService';
import { Panel, Button, IconButton, Input, Select, Badge } from './ui/Primitives';

interface SettingsModalProps { workspace: Workspace; onUpdateWorkspace: (ws: Workspace) => void; onClose: () => void; }

const SettingsModal: React.FC<SettingsModalProps> = ({ workspace, onUpdateWorkspace, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'tags' | 'hotkeys' | 'maintenance'>('general');
  const [isProcessing, setIsProcessing] = useState(false);
  const [newTag, setNewTag] = useState('');

  const updateSettings = (partial: Partial<SettingsData>) => {
      const newWs = { ...workspace, settings: { ...workspace.settings, ...partial, updatedAt: Date.now() } };
      onUpdateWorkspace(newWs); vaultService.debouncedSaveSettings(newWs.settings);
  };
  const updateHotkeys = (bindings: KeyBinding[]) => {
      const newWs = { ...workspace, hotkeys: { ...workspace.hotkeys, bindings, updatedAt: Date.now() } };
      onUpdateWorkspace(newWs); vaultService.debouncedSaveHotkeys(newWs.hotkeys);
  };
  const handleAddTag = () => {
      if (!newTag.trim()) return;
      const currentTags = workspace.settings.universeTags.tags;
      if (currentTags.includes(newTag.trim())) return;
      updateSettings({ universeTags: { ...workspace.settings.universeTags, tags: [...currentTags, newTag.trim()] } });
      setNewTag('');
  };
  const handleRemoveTag = (tag: string) => { if (confirm(`Remove tag "${tag}"?`)) updateSettings({ universeTags: { ...workspace.settings.universeTags, tags: workspace.settings.universeTags.tags.filter(t => t !== tag) } }); };
  const handleHotkeyChange = (index: number, newKey: string) => { const newBindings = [...workspace.hotkeys.bindings]; newBindings[index].keys = newKey; updateHotkeys(newBindings); };
  const handleRebuildIndex = async () => { if (!confirm("Rebuild index?")) return; setIsProcessing(true); await vaultService.rebuildIndex(); onUpdateWorkspace({...workspace}); setIsProcessing(false); };
  const handleRepairVault = async () => { if (!confirm("Repair vault?")) return; setIsProcessing(true); await vaultService.resyncVault('full'); onUpdateWorkspace({...workspace}); setIsProcessing(false); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Panel className="w-[600px] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden rounded-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-panel">
                <h2 className="text-lg font-bold text-text">Settings</h2>
                <IconButton onClick={onClose}><X size={20} /></IconButton>
            </div>
            <div className="flex flex-1 overflow-hidden">
                <div className="w-[150px] bg-panel2 border-r border-border flex flex-col p-2 gap-1">
                    <TabButton id="general" label="General" icon={Monitor} active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
                    <TabButton id="tags" label="Tags" icon={Tag} active={activeTab === 'tags'} onClick={() => setActiveTab('tags')} />
                    <TabButton id="hotkeys" label="Hotkeys" icon={Keyboard} active={activeTab === 'hotkeys'} onClick={() => setActiveTab('hotkeys')} />
                    <TabButton id="maintenance" label="Maintenance" icon={Database} active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} />
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-panel">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-text2 mb-4 flex items-center gap-2"><Shield size={14} /> Validation</h3>
                                <Toggle label="Strict Mode" description="Enforce validation rules on save." checked={workspace.settings.validation.strictMode} onChange={(v) => updateSettings({ validation: { ...workspace.settings.validation, strictMode: v } })} />
                            </section>
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-text2 mb-4">Note Defaults</h3>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-text">Default Status</label>
                                    <Select value={workspace.settings.notes.defaultStatus} onChange={(e) => updateSettings({ notes: { ...workspace.settings.notes, defaultStatus: e.target.value as any } })}>
                                        <option value="Draft">Draft</option>
                                        <option value="Experimental">Experimental</option>
                                        <option value="Canon">Canon</option>
                                    </Select>
                                </div>
                            </section>
                        </div>
                    )}
                    {activeTab === 'tags' && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Input placeholder="New Tag Name" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTag()} />
                                <Button onClick={handleAddTag} size="icon"><Plus size={16} /></Button>
                            </div>
                            <div className="space-y-2">
                                {workspace.settings.universeTags.tags.map(tag => (
                                    <div key={tag} className="flex items-center justify-between p-3 bg-panel2 border border-border rounded group">
                                        <span className="text-sm font-medium text-text">{tag}</span>
                                        <IconButton onClick={() => handleRemoveTag(tag)} variant="danger" size="sm" className="opacity-0 group-hover:opacity-100"><Trash2 size={14} /></IconButton>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTab === 'hotkeys' && (
                        <div className="space-y-2">
                            {workspace.hotkeys.bindings.map((binding, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-panel2 border border-border rounded">
                                    <span className="text-sm font-medium text-text">{binding.label || binding.command}</span>
                                    <input className="bg-bg border border-border rounded px-2 py-1 text-xs font-mono text-accent w-32 text-center focus:border-accent focus:outline-none" value={binding.keys} onChange={(e) => handleHotkeyChange(idx, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    )}
                    {activeTab === 'maintenance' && (
                         <div className="space-y-6">
                            <section className="bg-panel2 border border-border p-4 rounded-lg">
                                <h3 className="text-sm font-bold text-text mb-2 flex items-center gap-2"><Database size={16} className="text-accent"/> Index</h3>
                                <p className="text-xs text-text2 mb-4">Re-scan all files.</p>
                                <Button onClick={handleRebuildIndex} disabled={isProcessing} size="sm"><RefreshCw size={14} className={isProcessing ? 'animate-spin mr-2' : 'mr-2'} /> Rebuild</Button>
                            </section>
                            <section className="bg-panel2 border border-border p-4 rounded-lg">
                                <h3 className="text-sm font-bold text-text mb-2 flex items-center gap-2"><AlertTriangle size={16} className="text-warning"/> Repair</h3>
                                <p className="text-xs text-text2 mb-4">Full consistency check.</p>
                                <Button onClick={handleRepairVault} disabled={isProcessing} size="sm" variant="danger"><Shield size={14} className="mr-2"/> Repair</Button>
                            </section>
                         </div>
                    )}
                </div>
            </div>
        </Panel>
    </div>
  );
};

const TabButton: React.FC<{ id: string, label: string, icon: React.ElementType, active: boolean, onClick: () => void }> = ({ label, icon: Icon, active, onClick }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-bold transition-colors w-full text-left ${active ? 'bg-accent/10 text-accent' : 'text-text2 hover:text-text hover:bg-panel'}`}>
        <Icon size={14} />{label}
    </button>
);

const Toggle: React.FC<{ label: string; description: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, description, checked, onChange }) => (
    <div className="flex items-start justify-between group cursor-pointer" onClick={() => onChange(!checked)}>
        <div><div className="text-sm font-medium text-text group-hover:text-accent transition-colors">{label}</div><div className="text-xs text-text2 max-w-[300px]">{description}</div></div>
        <button className={`w-9 h-5 rounded-full relative transition-colors mt-1 ${checked ? 'bg-accent' : 'bg-panel2 border border-border'}`}>
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
    </div>
);
export default SettingsModal;
