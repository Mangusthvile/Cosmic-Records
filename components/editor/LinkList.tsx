
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Plus } from 'lucide-react';

interface LinkListProps {
    items: any[];
    command: (item: any) => void;
}

export const LinkList = forwardRef((props: LinkListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    const upHandler = () => {
        setSelectedIndex(((selectedIndex + props.items.length) - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }
            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }
            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }
            return false;
        },
    }));

    if (props.items.length === 0) {
        return null;
    }

    return (
        <div className="bg-panel border border-border rounded-lg shadow-2xl overflow-hidden min-w-[200px] max-w-[300px] animate-in fade-in zoom-in-95 duration-75">
            {props.items.map((item, index) => (
                <button
                    key={index}
                    className={`
                        w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 cursor-pointer
                        ${index === selectedIndex ? 'bg-accent/20 text-accent' : 'hover:bg-surface text-foreground'}
                        ${item.isCreate ? 'border-t border-border mt-1' : ''}
                    `}
                    onClick={() => selectItem(index)}
                >
                    {item.isCreate ? (
                        <>
                            <Plus size={12} className="opacity-70" />
                            <span className="truncate flex-1 font-bold">Create "{item.title}"</span>
                        </>
                    ) : (
                        <>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                item.unresolved ? 'bg-danger' : 
                                item.status === 'Canon' ? 'bg-success' : 'bg-muted'
                            }`}></span>
                            <span className={`truncate flex-1 ${item.unresolved ? 'text-danger' : ''}`}>{item.title}</span>
                        </>
                    )}
                </button>
            ))}
        </div>
    );
});

export default LinkList;
