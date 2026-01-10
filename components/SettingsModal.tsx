
import React, { useState } from 'react';
import { Workspace, SettingsData, HotkeysData, KeyBinding, MigrationPlan } from '../types';
import { X, Monitor, Keyboard, Tag, Shield, Database, AlertTriangle, RefreshCw, Plus, Trash2, Palette, Stethoscope, ArrowRight, CheckCircle, FileText, HardDrive } from 'lucide-react';
import { vaultService } from '../services/vaultService';
import { analyzeMigration, applyMigration } from '../services/migrationService';
import { Panel, Button, IconButton, Input, Select, Badge } from './ui/Primitives';

interface SettingsModalProps { workspace: Workspace; onUpdateWorkspace: (ws: Workspace) => void; onClose: () => void; }

const SettingsModal: React.FC<SettingsModalProps> = ({ workspace, onUpdateWorkspace, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'tags' | 'hotkeys' | 'maintenance' | 'migration'>('general');
  const [isProcessing, setIsProcessing] = useState(false);
  const [doctorResult, setDoctorResult] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  
  // Migration State
  const [migrationPlan, setMigrationPlan] = useState<MigrationPlan | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'analyzing' | 'ready' | 'migrating' | 'complete' | 'error'>('idle');
  const [migrationError, setMigrationError] = useState<string | null>(null);

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
  const handleVaultDoctor = async () => { 
      setIsProcessing(true); 
      const res = await vaultService.runVaultDoctor(); 
      setDoctorResult(res.message); 
      onUpdateWorkspace({...workspace}); 
      setIsProcessing(false); 
  };

  const handleAnalyzeMigration = async () => {
      setMigrationStatus('analyzing');
      try {
          const plan = await analyzeMigration(workspace);
          setMigrationPlan(plan);
          setMigrationStatus('ready');
      } catch (e: any) {
          setMigrationStatus('error');
          setMigrationError(e.message);
      }
  };

  const handleApplyMigration = async () => {
      if (!migrationPlan) return;
      setMigrationStatus('migrating');
      try {
          const res = await applyMigration(migrationPlan, workspace);
          if (res.success) {
              setMigrationStatus('complete');
              // Force reload to reflect file names
              await vaultService.rebuildIndex();
              onUpdateWorkspace({ ...workspace });
          } else {
              setMigrationStatus('error');
              setMigrationError(res.error || "Unknown error");
          }
      } catch (e: any) {
          setMigrationStatus('error');
          setMigrationError(e.message);
      }
  };

  const accentColors = ['#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#f87171'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Panel className="w-[800px] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden rounded-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-panel">
                <h2 className="text-lg font-bold text-text">Settings</h2>
                <IconButton onClick={onClose}><X size={20} /></IconButton>
            </div>
            <div className="flex flex-1 overflow-hidden">
                <div className="w-[180px] bg-panel2 border-r border-border flex flex-col p-2 gap-1 flex-shrink-0">
                    <TabButton id="general" label="General" icon={Monitor} active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
                    <TabButton id="tags" label="Tags" icon={Tag} active={activeTab === 'tags'} onClick={() => setActiveTab('tags')} />
                    <TabButton id="hotkeys" label="Hotkeys" icon={Keyboard} active={activeTab === 'hotkeys'} onClick={() => setActiveTab('hotkeys')} />
                    <TabButton id="maintenance" label="Maintenance" icon={Database} active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} />
                    <div className="mt-4 border-t border-border pt-2">
                        <TabButton id="migration" label="Migration (M7)" icon={HardDrive} active={activeTab === 'migration'} onClick={() => setActiveTab('migration')} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-panel">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-text2 mb-4 flex items-center gap-2"><Palette size={14} /> Appearance</h3>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-text">Accent Color</label>
                                    <div className="flex gap-2">
                                        {accentColors.map(color => (
                                            <button key={color} onClick={() => updateSettings({ ui: { ...workspace.settings.ui, accentColor: color } })} className={`w-6 h-6 rounded-full border-2 ${workspace.settings.ui.accentColor === color ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} />
                                        ))}
                                    </div>
                                </div>
                            </section>
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
                                <h3 className="text-sm font-bold text-text mb-2 flex items-center gap-2"><Stethoscope size={16} className="text-warning"/> Vault Doctor</h3>
                                <p className="text-xs text-text2 mb-4">Detect and fix duplicate files and index inconsistencies.</p>
                                <Button onClick={handleVaultDoctor} disabled={isProcessing} size="sm" variant="outline"><Shield size={14} className="mr-2"/> Scan & Repair</Button>
                                {doctorResult && <div className="mt-2 text-xs text-success bg-success/10 p-2 rounded border border-success/20">{doctorResult}</div>}
                            </section>
                         </div>
                    )}
                    {activeTab === 'migration' && (
                        <div className="space-y-6">
                            <div className="bg-accent/5 border border-accent/20 rounded p-4">
                                <h3 className="text-lg font-bold text-accent mb-2">Milestone 7 Migration</h3>
                                <p className="text-sm text-text2 mb-4">
                                    Consolidate vault into 4 base note types (General, Modular, Place, Canvas) and rename files to canonical format.
                                    This operation is safe and reversible (backups created).
                                </p>
                                
                                {migrationStatus === 'idle' && (
                                    <Button onClick={handleAnalyzeMigration} className="w-full py-4 text-base font-bold">
                                        Analyze Vault
                                    </Button>
                                )}
                                
                                {migrationStatus === 'analyzing' && (
                                    <div className="text-center py-8 text-text2 animate-pulse">Scanning files...</div>
                                )}

                                {migrationStatus === 'ready' && migrationPlan && (
                                    <div className="space-y-4 animate-in fade-in">
                                        <div className="bg-bg border border-border rounded p-4 max-h-[300px] overflow-y-auto">
                                            <div className="text-xs font-bold uppercase tracking-widest text-text2 mb-2 sticky top-0 bg-bg pb-2 border-b border-border">Proposed Actions ({migrationPlan.actions.length})</div>
                                            {migrationPlan.actions.length === 0 ? (
                                                <div className="text-sm text-success flex items-center gap-2"><CheckCircle size={14}/> Vault is already clean.</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {migrationPlan.actions.map((action, i) => (
                                                        <div key={i} className="text-xs p-2 rounded bg-panel border border-border flex flex-col gap-1">
                                                            <div className="font-bold flex items-center gap-2">
                                                                {action.kind === 'convertNoteType' && <span className="text-accent">CONVERT TYPE</span>}
                                                                {action.kind === 'renameFile' && <span className="text-warning">RENAME</span>}
                                                                {action.kind === 'resolveConflict' && <span className="text-danger">CONFLICT</span>}
                                                                <span className="opacity-50 text-[10px]">{action.noteId?.substring(0,6)}</span>
                                                            </div>
                                                            {action.kind === 'convertNoteType' && <div>{action.oldType} &rarr; {action.newType}</div>}
                                                            {action.kind === 'renameFile' && (
                                                                <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center opacity-70">
                                                                    <div className="truncate text-right" title={action.fromPath}>{action.fromPath?.split('/').pop()}</div>
                                                                    <ArrowRight size={10} />
                                                                    <div className="truncate font-bold" title={action.toPath}>{action.toPath?.split('/').pop()}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        
                                        {migrationPlan.actions.length > 0 && (
                                            <Button onClick={handleApplyMigration} className="w-full py-3 bg-warning text-black hover:bg-warning/90 font-bold">
                                                Apply Migration (Create Backups & Execute)
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {migrationStatus === 'migrating' && (
                                    <div className="text-center py-8">
                                        <RefreshCw className="animate-spin mx-auto mb-2 text-accent" size={24} />
                                        <div className="text-sm text-text">Migrating files... Do not close window.</div>
                                    </div>
                                )}

                                {migrationStatus === 'complete' && (
                                    <div className="bg-success/10 border border-success/30 text-success p-4 rounded text-center">
                                        <CheckCircle className="mx-auto mb-2" size={24} />
                                        <h4 className="font-bold">Migration Complete</h4>
                                        <p className="text-xs opacity-80">Files renamed and types updated. Index rebuilt.</p>
                                    </div>
                                )}

                                {migrationStatus === 'error' && (
                                    <div className="bg-danger/10 border border-danger/30 text-danger p-4 rounded text-center">
                                        <AlertTriangle className="mx-auto mb-2" size={24} />
                                        <h4 className="font-bold">Migration Failed</h4>
                                        <p className="text-xs">{migrationError}</p>
                                        <Button size="sm" variant="outline" onClick={() => setMigrationStatus('idle')} className="mt-2">Retry</Button>
                                    </div>
                                )}
                            </div>
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
