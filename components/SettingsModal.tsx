
import React, { useState } from 'react';
import { Workspace, SettingsData, HotkeysData, KeyBinding } from '../types';
import { X, Monitor, Keyboard, Tag, Shield, Save, Plus, Trash2 } from 'lucide-react';
import { vaultService } from '../services/vaultService';

interface SettingsModalProps {
  workspace: Workspace;
  onUpdateWorkspace: (ws: Workspace) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ workspace, onUpdateWorkspace, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'tags' | 'hotkeys'>('general');
  
  // Local state for edits
  const [newTag, setNewTag] = useState('');

  const updateSettings = (partial: Partial<SettingsData>) => {
      const newWs = { ...workspace, settings: { ...workspace.settings, ...partial, updatedAt: Date.now() } };
      onUpdateWorkspace(newWs);
      vaultService.debouncedSaveSettings(newWs.settings);
  };

  const updateHotkeys = (bindings: KeyBinding[]) => {
      const newWs = { ...workspace, hotkeys: { ...workspace.hotkeys, bindings, updatedAt: Date.now() } };
      onUpdateWorkspace(newWs);
      vaultService.debouncedSaveHotkeys(newWs.hotkeys);
  };

  // --- Handlers ---

  const handleAddTag = () => {
      if (!newTag.trim()) return;
      const currentTags = workspace.settings.universeTags.tags;
      if (currentTags.includes(newTag.trim())) return;
      
      const newTags = [...currentTags, newTag.trim()];
      updateSettings({ 
          universeTags: { ...workspace.settings.universeTags, tags: newTags } 
      });
      setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
      if (confirm(`Remove universe tag "${tag}"? Notes using it will not be deleted but may need updating.`)) {
          const newTags = workspace.settings.universeTags.tags.filter(t => t !== tag);
          updateSettings({
              universeTags: { ...workspace.settings.universeTags, tags: newTags }
          });
      }
  };

  const handleHotkeyChange = (index: number, newKey: string) => {
      const newBindings = [...workspace.hotkeys.bindings];
      newBindings[index].keys = newKey;
      updateHotkeys(newBindings);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-[600px] bg-panel border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200 overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-chrome-panel">
                <h2 className="text-lg font-bold text-foreground">Settings</h2>
                <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-[150px] bg-surface/50 border-r border-border flex flex-col p-2 gap-1">
                    <TabButton id="general" label="General" icon={Monitor} active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
                    <TabButton id="tags" label="Universe Tags" icon={Tag} active={activeTab === 'tags'} onClick={() => setActiveTab('tags')} />
                    <TabButton id="hotkeys" label="Hotkeys" icon={Keyboard} active={activeTab === 'hotkeys'} onClick={() => setActiveTab('hotkeys')} />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-panel">
                    
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-faint mb-4 flex items-center gap-2">
                                    <Shield size={14} /> Validation
                                </h3>
                                <Toggle 
                                    label="Strict Mode"
                                    description="Enforce validation rules on save."
                                    checked={workspace.settings.validation.strictMode}
                                    onChange={(v) => updateSettings({ 
                                        validation: { ...workspace.settings.validation, strictMode: v } 
                                    })}
                                />
                            </section>
                            
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-faint mb-4">Note Defaults</h3>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-foreground">Default Status</label>
                                    <select 
                                        className="bg-surface border border-border rounded px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                        value={workspace.settings.notes.defaultStatus}
                                        onChange={(e) => updateSettings({ 
                                            notes: { ...workspace.settings.notes, defaultStatus: e.target.value as any } 
                                        })}
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Experimental">Experimental</option>
                                        <option value="Canon">Canon</option>
                                    </select>
                                    <p className="text-xs text-muted">Applied to new notes created without specific status.</p>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'tags' && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                    placeholder="New Tag Name"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                />
                                <button onClick={handleAddTag} className="bg-accent text-white px-3 py-2 rounded text-sm font-bold hover:opacity-90">
                                    <Plus size={16} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {workspace.settings.universeTags.tags.map(tag => (
                                    <div key={tag} className="flex items-center justify-between p-3 bg-surface border border-border rounded hover:border-accent/30 group">
                                        <span className="text-sm font-medium text-foreground">{tag}</span>
                                        <button onClick={() => handleRemoveTag(tag)} className="text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'hotkeys' && (
                        <div className="space-y-2">
                            {workspace.hotkeys.bindings.map((binding, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-surface border border-border rounded">
                                    <span className="text-sm font-medium text-foreground">{binding.label || binding.command}</span>
                                    <input 
                                        className="bg-chrome-bg border border-border rounded px-2 py-1 text-xs font-mono text-accent w-32 text-center focus:border-accent focus:outline-none"
                                        value={binding.keys}
                                        onChange={(e) => handleHotkeyChange(idx, e.target.value)}
                                    />
                                </div>
                            ))}
                            <p className="text-xs text-muted italic mt-4 text-center">
                                Use 'Mod' for Cmd/Ctrl. Format: Mod+Shift+K
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    </div>
  );
};

const TabButton: React.FC<{ id: string, label: string, icon: React.ElementType, active: boolean, onClick: () => void }> = ({ label, icon: Icon, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-bold transition-colors w-full text-left
            ${active ? 'bg-accent/10 text-accent' : 'text-muted hover:text-foreground hover:bg-surface'}
        `}
    >
        <Icon size={14} />
        {label}
    </button>
);

const Toggle: React.FC<{ label: string; description: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, description, checked, onChange }) => (
    <div className="flex items-start justify-between group cursor-pointer" onClick={() => onChange(!checked)}>
        <div>
            <div className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{label}</div>
            <div className="text-xs text-muted max-w-[300px]">{description}</div>
        </div>
        <button 
            className={`w-9 h-5 rounded-full relative transition-colors mt-1 ${checked ? 'bg-accent' : 'bg-surface border border-border'}`}
        >
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
    </div>
);

export default SettingsModal;
