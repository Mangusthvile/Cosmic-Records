
import React from 'react';
import { Workspace, UserPreferences } from '../types';
import { X, Monitor, Bot, Volume2, Settings as SettingsIcon, Database, RefreshCw } from 'lucide-react';
import { vaultService } from '../services/vaultService';

interface SettingsModalProps {
  workspace: Workspace;
  onUpdateWorkspace: (ws: Workspace) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ workspace, onUpdateWorkspace, onClose }) => {
  const prefs = workspace.user_preferences;
  const [isRebuilding, setIsRebuilding] = React.useState(false);

  const updatePref = (category: keyof UserPreferences, key: string, value: any) => {
    const newWorkspace = { ...workspace };
    newWorkspace.user_preferences = {
        ...workspace.user_preferences,
        [category]: {
            ...workspace.user_preferences[category],
            [key]: value
        }
    };
    onUpdateWorkspace(newWorkspace);
  };

  const handleRebuildIndex = async () => {
      if (confirm("Rebuild the search index by scanning all files? This may take a moment.")) {
          setIsRebuilding(true);
          try {
              await vaultService.rebuildIndex(workspace);
              alert("Index rebuilt successfully.");
          } catch (e) {
              alert("Failed to rebuild index.");
          } finally {
              setIsRebuilding(false);
          }
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-[500px] bg-panel border border-border rounded-xl shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <SettingsIcon size={20} className="text-cosmic-accent" />
                    System Settings
                </h2>
                <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                
                {/* UI Section */}
                <section>
                    <h3 className="text-[var(--fs-xs)] font-bold uppercase tracking-widest text-faint mb-4 flex items-center gap-2">
                        <Monitor size={14} /> Interface
                    </h3>
                    <div className="space-y-3">
                        <Toggle 
                            label="Gray out outdated titles"
                            description="Visually dim notes marked as outdated in lists."
                            checked={prefs.ui.gray_out_outdated_titles}
                            onChange={(v) => updatePref('ui', 'gray_out_outdated_titles', v)}
                        />
                         <Toggle 
                            label="Show badges in search"
                            description="Display status indicators in search results."
                            checked={prefs.ui.show_badges_in_search}
                            onChange={(v) => updatePref('ui', 'show_badges_in_search', v)}
                        />
                         <Toggle 
                            label="Prominent Unresolved Warnings"
                            description="Highlight unresolved links aggressively."
                            checked={prefs.ui.show_unresolved_prominently}
                            onChange={(v) => updatePref('ui', 'show_unresolved_prominently', v)}
                        />
                    </div>
                </section>

                {/* AI Section */}
                <section>
                     <h3 className="text-[var(--fs-xs)] font-bold uppercase tracking-widest text-faint mb-4 flex items-center gap-2">
                        <Bot size={14} /> Artificial Intelligence
                    </h3>
                    <div className="space-y-3">
                        <Toggle 
                            label="Proactive Suggestions"
                            description="Allow the assistant to offer unsolicited advice."
                            checked={prefs.ai.proactive}
                            onChange={(v) => updatePref('ai', 'proactive', v)}
                        />
                        <Toggle 
                            label="Allow Auto-Edits"
                            description="Grant permission for minor text corrections without prompt."
                            checked={prefs.ai.allow_auto_edits}
                            onChange={(v) => updatePref('ai', 'allow_auto_edits', v)}
                        />
                    </div>
                </section>

                 {/* TTS Section */}
                 <section>
                     <h3 className="text-[var(--fs-xs)] font-bold uppercase tracking-widest text-faint mb-4 flex items-center gap-2">
                        <Volume2 size={14} /> Text-to-Speech
                    </h3>
                     <div className="flex items-center justify-between py-2 border-t border-border pt-4">
                        <div>
                            <div className="text-[var(--fs-sm)] font-medium text-foreground">Voice Mode</div>
                            <div className="text-[var(--fs-xs)] text-muted">Current speech synthesis behavior.</div>
                        </div>
                        <div className="text-[10px] font-mono bg-[var(--bg)] px-2 py-1 rounded text-muted border border-border">
                            {prefs.tts.mode}
                        </div>
                    </div>
                 </section>

                 {/* Maintenance */}
                 <section>
                    <h3 className="text-[var(--fs-xs)] font-bold uppercase tracking-widest text-faint mb-4 flex items-center gap-2">
                        <Database size={14} /> Maintenance
                    </h3>
                    <div className="p-4 bg-surface border border-border rounded-lg flex items-center justify-between">
                         <div>
                             <div className="text-sm font-bold text-foreground">Rebuild Index</div>
                             <div className="text-xs text-muted max-w-[250px]">Scan all files to repair missing search entries.</div>
                         </div>
                         <button 
                            onClick={handleRebuildIndex}
                            disabled={isRebuilding}
                            className="flex items-center gap-2 px-3 py-1.5 bg-chrome-panel border border-border rounded hover:bg-surface text-xs font-bold text-accent disabled:opacity-50"
                         >
                             <RefreshCw size={12} className={isRebuilding ? "animate-spin" : ""} />
                             {isRebuilding ? "Scanning..." : "Rebuild"}
                         </button>
                    </div>
                 </section>

            </div>
        </div>
    </div>
  );
};

const Toggle: React.FC<{ label: string; description: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, description, checked, onChange }) => (
    <div className="flex items-start justify-between group cursor-pointer" onClick={() => onChange(!checked)}>
        <div>
            <div className="text-[var(--fs-sm)] font-medium text-foreground group-hover:text-cosmic-accent transition-colors">{label}</div>
            <div className="text-[var(--fs-xs)] text-muted max-w-[300px]">{description}</div>
        </div>
        <button 
            className={`w-10 h-5 rounded-full relative transition-colors mt-1 ${checked ? 'bg-cosmic-accent' : 'bg-[var(--panel-3)] border border-border'}`}
        >
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    </div>
);

export default SettingsModal;
