import React from 'react';
import { vaultService } from '../services/vaultService';
import { FolderOpen, Plus, Monitor, HardDrive } from 'lucide-react';

interface VaultPickerProps {
    onReady: () => void;
}

const VaultPicker: React.FC<VaultPickerProps> = ({ onReady }) => {
    
    const handleOpen = async () => {
        try {
            await vaultService.openPicker();
            onReady();
        } catch (e) {
            // Ignore cancel
        }
    };

    const handleDemo = async () => {
        await vaultService.useDemo();
        onReady();
    };

    return (
        <div className="h-screen w-screen bg-chrome-bg flex items-center justify-center font-sans text-foreground">
            <div className="w-[450px] bg-panel border border-border rounded-xl shadow-2xl p-8 flex flex-col gap-8 animate-in zoom-in-95 duration-300">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-accent/20 shadow-glow">
                        <HardDrive size={32} className="text-accent" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Cosmic Records</h1>
                    <p className="text-muted text-sm">Select a vault location to begin.</p>
                </div>

                <div className="space-y-3">
                    <button 
                        onClick={handleOpen}
                        className="w-full flex items-center gap-4 p-4 bg-surface border border-border rounded-lg hover:border-accent hover:bg-accent/5 transition-all group text-left"
                    >
                        <div className="bg-chrome-bg p-2 rounded border border-border group-hover:border-accent/50 text-muted group-hover:text-accent transition-colors">
                            <FolderOpen size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-sm text-foreground">Open Local Vault</div>
                            <div className="text-xs text-muted">Select a folder on your device.</div>
                        </div>
                    </button>

                    <button 
                        onClick={handleOpen} // Reuses open logic which creates if empty
                        className="w-full flex items-center gap-4 p-4 bg-surface border border-border rounded-lg hover:border-accent hover:bg-accent/5 transition-all group text-left"
                    >
                        <div className="bg-chrome-bg p-2 rounded border border-border group-hover:border-accent/50 text-muted group-hover:text-accent transition-colors">
                            <Plus size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-sm text-foreground">Create New Vault</div>
                            <div className="text-xs text-muted">Initialize a new folder.</div>
                        </div>
                    </button>
                    
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-panel px-2 text-muted">Or</span></div>
                    </div>

                    <button 
                        onClick={handleDemo}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface text-muted hover:text-foreground transition-colors justify-center"
                    >
                        <Monitor size={16} />
                        <span className="text-xs font-bold">Continue with Browser Storage (Demo)</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VaultPicker;