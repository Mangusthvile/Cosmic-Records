import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    separator?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Simple boundary checking (clamping) could be added here if needed
    const style: React.CSSProperties = {
        top: y,
        left: x,
    };

    return (
        <div 
            ref={menuRef}
            className="fixed z-[1000] min-w-[180px] bg-panel border border-border rounded-lg shadow-2xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-75"
            style={style}
        >
            {items.map((item, index) => {
                if (item.separator) {
                    return <div key={index} className="h-[1px] bg-border my-1" />;
                }
                
                const Icon = item.icon;
                return (
                    <button
                        key={index}
                        onClick={() => {
                            if (!item.disabled) {
                                item.onClick();
                                onClose();
                            }
                        }}
                        disabled={item.disabled}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[var(--c-hover)] transition-colors
                            ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            ${item.danger ? 'text-danger hover:text-red-400' : 'text-foreground'}
                        `}
                    >
                        {Icon && <Icon size={14} className="opacity-70" />}
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default ContextMenu;