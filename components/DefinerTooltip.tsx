
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Plus, ExternalLink, Globe } from 'lucide-react';
import { Button } from './ui/Primitives';

interface DefinerTooltipProps {
    x: number;
    y: number;
    termId: string | null; // Null if no match found
    text: string; // The text hovered/selected
    definitionPreview?: string;
    universeScopes?: string[];
    onOpenDefinition: () => void;
    onAddToPending: () => void;
    onClose: () => void;
    isLoading?: boolean;
}

const DefinerTooltip: React.FC<DefinerTooltipProps> = ({ 
    x, y, termId, text, definitionPreview, universeScopes, 
    onOpenDefinition, onAddToPending, onClose, isLoading 
}) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ 
        top: -9999, left: -9999, opacity: 0 
    });

    useEffect(() => {
        // Positioning Logic
        // We want the tooltip to be above the cursor/selection if space allows, else below.
        // It must stay within viewport.
        if (tooltipRef.current) {
            const el = tooltipRef.current;
            const rect = el.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            let top = y - rect.height - 10; // Default above
            let left = x - rect.width / 2;  // Centered

            // Viewport collision
            if (top < 10) top = y + 20; // Flip to below
            if (left < 10) left = 10;
            if (left + rect.width > viewportWidth - 10) left = viewportWidth - rect.width - 10;

            setStyle({ top, left, opacity: 1 });
        }
    }, [x, y, termId, text]); // Re-calc on prop change

    // Click outside to close (handled by parent typically, but we can add safety)
    
    return createPortal(
        <div 
            ref={tooltipRef}
            className="fixed z-[9999] w-[280px] bg-panel border border-accent/30 rounded-lg shadow-2xl p-3 text-text pointer-events-auto flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100"
            style={style}
            onMouseDown={(e) => e.stopPropagation()} // Prevent editor blur/deselection if possible
        >
            {isLoading ? (
                <div className="flex items-center gap-2 text-text2 text-xs">
                    <span className="w-3 h-3 border-2 border-accent/50 border-t-accent rounded-full animate-spin"></span>
                    Looking up...
                </div>
            ) : termId ? (
                // MATCH FOUND
                <>
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <BookOpen size={14} className="text-accent" />
                                <span className="text-sm font-bold">{text}</span> 
                                {/* If alias matches but primary is different, show primary? Logic handled by caller sending correct text/name */}
                            </div>
                            {universeScopes && universeScopes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                    {universeScopes.map(s => (
                                        <span key={s} className="text-[9px] px-1 rounded bg-accent/10 text-accent border border-accent/20">{s}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="text-xs text-text2 line-clamp-3 leading-relaxed border-l-2 border-accent/20 pl-2">
                        {definitionPreview || <em className="opacity-50">No text content.</em>}
                    </div>

                    <div className="pt-2 mt-1 border-t border-border flex gap-2">
                        <Button size="sm" onClick={onOpenDefinition} className="w-full flex items-center justify-center gap-2 text-[10px]">
                            <ExternalLink size={12} /> View Definition
                        </Button>
                    </div>
                </>
            ) : (
                // NO MATCH
                <>
                    <div className="flex items-center gap-2 text-text2 text-xs mb-1">
                        <BookOpen size={14} className="opacity-50" />
                        <span className="font-bold italic">"{text}"</span>
                        <span className="opacity-50 ml-auto text-[10px] uppercase">Unknown</span>
                    </div>
                    <div className="text-xs text-muted">
                        Term not found in glossary.
                    </div>
                    <div className="pt-2 mt-1 border-t border-border">
                        <Button size="sm" variant="outline" onClick={onAddToPending} className="w-full flex items-center justify-center gap-2 text-[10px]">
                            <Plus size={12} /> Add to Pending
                        </Button>
                    </div>
                </>
            )}
        </div>,
        document.body
    );
};

export default DefinerTooltip;
