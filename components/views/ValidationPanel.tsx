
import React, { useState } from 'react';
import { ValidationResult, ValidationIssue } from '../../services/characterValidation';
import { AlertTriangle, AlertCircle, ChevronDown, ChevronRight, ArrowRight, Settings } from 'lucide-react';
import { Button } from '../ui/Primitives';

interface ValidationPanelProps {
    validation: ValidationResult;
    onFocusModule: (blockId: string) => void;
    onOpenNote: (noteId: string) => void;
    strictMode: boolean;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ validation, onFocusModule, onOpenNote, strictMode }) => {
    const [collapsed, setCollapsed] = useState(false);
    const { errors, warnings } = validation;
    const total = errors.length + warnings.length;

    if (total === 0) return null;

    const renderIssue = (issue: ValidationIssue) => (
        <div key={issue.id} className="flex items-start gap-2 p-2 rounded bg-surface/50 text-xs border border-border/50">
            <div className={`mt-0.5 ${issue.severity === 'error' ? 'text-danger' : 'text-warning'}`}>
                {issue.severity === 'error' ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
            </div>
            <div className="flex-1">
                <div className="text-text">{issue.message}</div>
                {issue.moduleType && <div className="text-[10px] text-text2 uppercase tracking-wide mt-0.5">{issue.moduleType}</div>}
            </div>
            {issue.action && (
                <button 
                    onClick={() => {
                        if (issue.action?.type === 'focusModule' && issue.blockId) onFocusModule(issue.blockId);
                        if (issue.action?.type === 'openNote' && issue.action.payload) onOpenNote(issue.action.payload);
                    }}
                    className="text-accent hover:underline text-[10px] whitespace-nowrap self-center"
                >
                    {issue.action.label}
                </button>
            )}
        </div>
    );

    return (
        <div className={`border-b border-border transition-colors ${errors.length > 0 ? 'bg-danger/5 border-danger/20' : 'bg-warning/5 border-warning/20'}`}>
            <div 
                className="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-black/5"
                onClick={() => setCollapsed(!collapsed)}
            >
                <div className="flex items-center gap-2">
                    {errors.length > 0 ? <AlertCircle size={14} className="text-danger" /> : <AlertTriangle size={14} className="text-warning" />}
                    <span className="text-xs font-bold text-text">
                        {strictMode && errors.length > 0 ? "Save Blocked: " : "Validation: "} 
                        {errors.length > 0 && <span className="text-danger">{errors.length} Error{errors.length > 1 ? 's' : ''}</span>}
                        {errors.length > 0 && warnings.length > 0 && ", "}
                        {warnings.length > 0 && <span className="text-warning">{warnings.length} Warning{warnings.length > 1 ? 's' : ''}</span>}
                    </span>
                </div>
                {collapsed ? <ChevronRight size={14} className="text-text2" /> : <ChevronDown size={14} className="text-text2" />}
            </div>
            
            {!collapsed && (
                <div className="px-4 pb-4 space-y-3">
                    {errors.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-[10px] font-bold uppercase text-danger opacity-70 tracking-widest">Errors</div>
                            {errors.map(renderIssue)}
                        </div>
                    )}
                    {warnings.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-[10px] font-bold uppercase text-warning opacity-70 tracking-widest">Warnings</div>
                            {warnings.map(renderIssue)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ValidationPanel;
