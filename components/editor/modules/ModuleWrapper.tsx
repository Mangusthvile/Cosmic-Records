
import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { ChevronDown, ChevronRight, GripVertical, Trash2, X } from 'lucide-react';
import { IconButton } from '../../ui/Primitives';
import { MODULE_REGISTRY } from './ModuleComponents';
import { useEditorContext } from '../EditorContext';

interface ModuleWrapperProps {
    node: any;
    updateAttributes: (attrs: any) => void;
    deleteNode: () => void;
    selected: boolean;
    editor: any;
    getPos: () => number;
}

const ModuleWrapper: React.FC<ModuleWrapperProps> = ({ node, updateAttributes, deleteNode, selected }) => {
    const { moduleType, moduleId, data, collapsed } = node.attrs;
    const { activeFormId, forms, onUpdateFormOverride } = useEditorContext();

    const ModuleComponent = MODULE_REGISTRY[moduleType] || MODULE_REGISTRY['generic'];
    const title = moduleType.charAt(0).toUpperCase() + moduleType.slice(1);

    // Form logic
    const isBase = !activeFormId || activeFormId === 'base';
    const activeForm = !isBase && forms ? forms.find(f => f.formId === activeFormId) : null;
    
    // Resolve data: Override > Base (Node Attributes)
    // Note: data in node.attrs IS the base data.
    const resolvedData = (activeForm && activeForm.overrides && activeForm.overrides[moduleId]) 
        ? activeForm.overrides[moduleId] 
        : data;

    const hasOverride = activeForm && activeForm.overrides && activeForm.overrides[moduleId];

    const handleDataChange = (newData: any) => {
        if (isBase) {
            updateAttributes({ data: newData });
        } else if (activeForm && onUpdateFormOverride) {
            // Write to override
            onUpdateFormOverride(moduleId, newData);
        }
    };

    const handleClearOverride = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeForm && onUpdateFormOverride) {
            onUpdateFormOverride(moduleId, undefined); // Clear override
        }
    };

    return (
        <NodeViewWrapper className={`my-4 border rounded-lg overflow-hidden transition-all bg-panel ${selected ? 'ring-2 ring-accent' : 'border-border'}`}>
            {/* Header */}
            <div 
                className={`flex items-center justify-between px-3 py-2 bg-panel2 border-b border-border select-none cursor-pointer hover:bg-panel transition-colors group`}
                onClick={() => updateAttributes({ collapsed: !collapsed })}
            >
                <div className="flex items-center gap-2">
                    <div className="text-text2 p-1 rounded hover:bg-surface cursor-grab active:cursor-grabbing" contentEditable={false} draggable="true" data-drag-handle>
                        <GripVertical size={14} />
                    </div>
                    {collapsed ? <ChevronRight size={14} className="text-text2" /> : <ChevronDown size={14} className="text-text2" />}
                    <span className="text-xs font-bold uppercase tracking-widest text-text2">{title}</span>
                    
                    {!isBase && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ml-2 ${hasOverride ? 'bg-accent/20 border-accent text-accent' : 'bg-surface border-border text-muted'}`}>
                            {hasOverride ? 'Overridden' : 'Base Value'}
                        </span>
                    )}
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isBase && hasOverride && (
                        <IconButton size="sm" onClick={handleClearOverride} title="Revert to Base" className="text-warning hover:text-danger">
                            <X size={14} />
                        </IconButton>
                    )}
                    <IconButton size="sm" onClick={(e) => { e.stopPropagation(); if(confirm("Remove module?")) deleteNode(); }} className="hover:text-danger">
                        <Trash2 size={14} />
                    </IconButton>
                </div>
            </div>

            {/* Body */}
            {!collapsed && (
                <div className="p-4 bg-panel">
                    <ModuleComponent 
                        data={resolvedData || {}} 
                        onChange={handleDataChange} 
                        readOnly={false} 
                        isOverride={!isBase && hasOverride}
                    />
                </div>
            )}
        </NodeViewWrapper>
    );
};

export default ModuleWrapper;
