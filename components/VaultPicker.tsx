
import React from 'react';
import { vaultService } from '../services/vaultService';
import { FolderOpen, Plus, Monitor, HardDrive } from 'lucide-react';
import { Panel, Button } from './ui/Primitives';

interface VaultPickerProps { onReady: () => void; }

const VaultPicker: React.FC<VaultPickerProps> = ({ onReady }) => {
    const handleOpen = async () => { try { await vaultService.openPicker(); onReady(); } catch (e) {} };
    const handleDemo = async () => { await vaultService.useDemo(); onReady(); };

    return (
        <div className="h-screen w-screen bg-bg flex items-center justify-center font-sans text-text">
            <Panel className="w-[450px] p-8 flex flex-col gap-8 animate-in zoom-in-95 duration-300 rounded-xl shadow-2xl">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-accent/20 shadow-glow">
                        <HardDrive size={32} className="text-accent" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Cosmic Records</h1>
                    <p className="text-text2 text-sm">Select a vault location to begin.</p>
                </div>
                <div className="space-y-3">
                    <button onClick={handleOpen} className="w-full flex items-center gap-4 p-4 bg-panel2 border border-border rounded-lg hover:border-accent hover:bg-accent/5 transition-all group text-left">
                        <div className="bg-bg p-2 rounded border border-border group-hover:border-accent/50 text-text2 group-hover:text-accent transition-colors"><FolderOpen size={20} /></div>
                        <div><div className="font-bold text-sm text-text">Open Local Vault</div><div className="text-xs text-text2">Select folder</div></div>
                    </button>
                    <button onClick={handleOpen} className="w-full flex items-center gap-4 p-4 bg-panel2 border border-border rounded-lg hover:border-accent hover:bg-accent/5 transition-all group text-left">
                        <div className="bg-bg p-2 rounded border border-border group-hover:border-accent/50 text-text2 group-hover:text-accent transition-colors"><Plus size={20} /></div>
                        <div><div className="font-bold text-sm text-text">Create New Vault</div><div className="text-xs text-text2">Initialize folder</div></div>
                    </button>
                    <div className="relative py-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-panel px-2 text-text2">Or</span></div></div>
                    <Button variant="ghost" onClick={handleDemo} className="w-full gap-2"><Monitor size={16} /> Continue with Demo</Button>
                </div>
            </Panel>
        </div>
    );
};
export default VaultPicker;
