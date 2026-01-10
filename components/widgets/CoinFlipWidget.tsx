
import React from 'react';
import { WidgetProps } from './WidgetRegistry';
import { Coins, Trash2 } from 'lucide-react';

interface CoinHistoryItem {
    id: string;
    timestamp: number;
    result: 'Heads' | 'Tails';
}

const CoinFlipWidget: React.FC<WidgetProps> = ({ state, onStateChange }) => {
    const history = (state?.history || []) as CoinHistoryItem[];

    const flip = () => {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const newItem: CoinHistoryItem = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            result
        };
        onStateChange({ history: [newItem, ...history].slice(0, 50) });
    };

    const clearHistory = () => onStateChange({ history: [] });

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-border bg-panel2/50 flex justify-center">
                <button
                    onClick={flip}
                    className="bg-accent text-bg px-6 py-2 rounded-full font-bold shadow-glow hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Coins size={16} /> Flip Coin
                </button>
            </div>

            <div className="flex items-center justify-between px-3 py-1 bg-panel border-b border-border text-[10px] text-text2 uppercase tracking-widest">
                <span>History</span>
                {history.length > 0 && <button onClick={clearHistory} className="hover:text-danger"><Trash2 size={10} /></button>}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {history.length === 0 ? (
                    <div className="text-center text-xs text-text2 italic mt-4 opacity-50">Flip a coin...</div>
                ) : (
                    history.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded bg-surface border border-border/50 animate-in slide-in-from-top-1">
                            <span className="text-[10px] text-text2 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</span>
                            <span className={`text-sm font-bold ${item.result === 'Heads' ? 'text-accent' : 'text-warning'}`}>{item.result}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CoinFlipWidget;
