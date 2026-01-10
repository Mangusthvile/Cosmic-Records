
import React, { useState, useRef, useEffect } from 'react';
import { WidgetProps } from './WidgetRegistry';
import { Dices, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { IconButton } from '../ui/Primitives';

interface RollTerm {
    expression: string; // "2d6"
    rolls: number[]; // [3, 5]
    total: number; // 8
    type: 'dice';
}

interface ConstTerm {
    expression: string; // "5"
    total: number;
    type: 'constant';
}

type BreakdownItem = RollTerm | ConstTerm;

interface RollResult {
    id: string;
    timestamp: number;
    expression: string; // The raw input
    total: number;
    breakdown: BreakdownItem[];
    error?: string;
}

interface DiceState {
    history: RollResult[];
    lastExpression: string;
}

const MAX_DICE_COUNT = 100; // N
const MAX_SIDES = 1000; // M
const MAX_TOTAL_ROLLS = 200; // Safety cap per expression

const DiceRollWidget: React.FC<WidgetProps> = ({ state, onStateChange }) => {
    const history = (state?.history || []) as RollResult[];
    const [input, setInput] = useState(state?.lastExpression || '');
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Sync input to state for persistence
    const handleInputChange = (val: string) => {
        setInput(val);
        onStateChange({ ...state, lastExpression: val });
        setError(null);
    };

    const parseAndRoll = (expr: string): RollResult => {
        // Normalize: remove spaces, lowercase
        const clean = expr.replace(/\s+/g, '').toLowerCase();
        
        // Regex to match terms: [+-]? (NdM | number)
        // Group 1: Full term including operator
        // Group 2: The value part (NdM or number)
        const regex = /([+-]?)((\d+d\d+)|(\d+))/g;
        
        let match;
        let total = 0;
        let totalDiceRolled = 0;
        const breakdown: BreakdownItem[] = [];
        let valid = false;

        while ((match = regex.exec(clean)) !== null) {
            valid = true;
            const operator = match[1] === '-' ? -1 : 1; // Default to +
            const term = match[2];

            if (term.includes('d')) {
                // Dice Term
                const [nStr, mStr] = term.split('d');
                let n = nStr ? parseInt(nStr) : 1; // "d20" -> 1d20
                let m = parseInt(mStr);

                if (isNaN(n) || isNaN(m)) continue; 
                
                // Safety Checks
                if (n > MAX_DICE_COUNT) throw new Error(`Too many dice (max ${MAX_DICE_COUNT})`);
                if (m > MAX_SIDES) throw new Error(`Too many sides (max ${MAX_SIDES})`);
                if (totalDiceRolled + n > MAX_TOTAL_ROLLS) throw new Error(`Total rolls exceed limit (${MAX_TOTAL_ROLLS})`);

                const rolls: number[] = [];
                let subTotal = 0;
                for (let i = 0; i < n; i++) {
                    const roll = Math.floor(Math.random() * m) + 1;
                    rolls.push(roll);
                    subTotal += roll;
                }
                
                totalDiceRolled += n;
                const termTotal = subTotal * operator;
                total += termTotal;

                breakdown.push({
                    type: 'dice',
                    expression: (operator === -1 ? '- ' : '+ ') + `${n}d${m}`,
                    rolls: rolls,
                    total: termTotal
                });

            } else {
                // Constant Term
                const val = parseInt(term);
                if (!isNaN(val)) {
                    const termVal = val * operator;
                    total += termVal;
                    breakdown.push({
                        type: 'constant',
                        expression: (operator === -1 ? '- ' : '+ ') + val,
                        total: termVal
                    });
                }
            }
        }

        if (!valid) throw new Error("Invalid expression");

        return {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            expression: expr,
            total,
            breakdown
        };
    };

    const handleRoll = (exprOverride?: string) => {
        const expr = exprOverride !== undefined ? exprOverride : input;
        if (!expr.trim()) return;

        try {
            const result = parseAndRoll(expr);
            const newHistory = [result, ...history].slice(0, 50); // Keep last 50
            onStateChange({ history: newHistory, lastExpression: input });
            setError(null);
            
            // Auto scroll to top logic if needed, but history adds to top
        } catch (e: any) {
            setError(e.message || "Parse error");
        }
    };

    const clearHistory = () => onStateChange({ ...state, history: [] });

    // Quick button handler: Append or Replace? 
    // Standard UX: If input empty, set it. If not empty, maybe add? 
    // Let's implement: Clicking a die button sets the input to "1dX" and rolls immediately if empty, 
    // OR if Shift key held, adds "+ 1dX" to input without rolling.
    // Simple version for Milestone: Replace input and roll.
    const rollDie = (sides: number) => {
        const expr = `1d${sides}`;
        handleInputChange(expr);
        handleRoll(expr);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden text-text">
            {/* Input Area */}
            <div className="p-3 border-b border-border bg-panel2/50 space-y-2">
                <div className="flex gap-2">
                    <input 
                        className="flex-1 bg-bg border border-border rounded px-2 py-1 text-sm font-mono text-text focus:border-accent focus:outline-none"
                        placeholder="e.g. 2d6 + 4"
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRoll()}
                    />
                    <button 
                        onClick={() => handleRoll()}
                        className="bg-accent text-bg px-3 py-1 rounded font-bold text-xs hover:bg-accent/90"
                    >
                        Roll
                    </button>
                </div>
                {error && <div className="text-[10px] text-danger flex items-center gap-1"><AlertTriangle size={10} /> {error}</div>}
                
                {/* Quick Dice */}
                <div className="grid grid-cols-7 gap-1">
                    {[4, 6, 8, 10, 12, 20, 100].map(d => (
                        <button
                            key={d}
                            onClick={() => rollDie(d)}
                            className="bg-panel border border-border hover:border-accent hover:text-accent rounded py-1 text-[10px] font-bold transition-colors"
                            title={`Roll d${d}`}
                        >
                            d{d}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* History Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-panel border-b border-border text-[10px] text-text2 uppercase tracking-widest">
                <span>History</span>
                {history.length > 0 && <button onClick={clearHistory} className="hover:text-danger"><Trash2 size={10} /></button>}
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2" ref={scrollRef}>
                {history.length === 0 ? (
                    <div className="text-center text-xs text-text2 italic mt-8 opacity-50">
                        Enter an expression or click a die to roll.
                    </div>
                ) : (
                    history.map(item => (
                        <div key={item.id} className="p-2 rounded bg-surface border border-border/50 animate-in slide-in-from-top-2 group relative">
                            {/* Re-roll Overlay Button */}
                            <button 
                                onClick={() => { handleInputChange(item.expression); handleRoll(item.expression); }}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                                title="Re-roll"
                            >
                                <RotateCcw size={12} />
                            </button>

                            <div className="flex justify-between items-baseline mb-1">
                                <span className="text-[10px] font-mono text-text2 truncate max-w-[120px]" title={item.expression}>{item.expression}</span>
                                <span className="text-lg font-bold text-accent">{item.total}</span>
                            </div>
                            
                            <div className="space-y-0.5">
                                {item.breakdown.map((part, idx) => (
                                    <div key={idx} className="flex justify-between text-[10px] text-muted font-mono">
                                        <span>
                                            {part.expression.replace(/^[+]/, '').trim()} 
                                            {part.type === 'dice' && (
                                                <span className="opacity-50 ml-1">
                                                    [{part.rolls.join(', ')}]
                                                </span>
                                            )}
                                        </span>
                                        <span className={part.total < 0 ? 'text-danger' : ''}>{part.total > 0 ? '+' : ''}{part.total}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="text-[9px] text-faint mt-1 text-right">
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DiceRollWidget;
