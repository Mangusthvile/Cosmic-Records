
import React, { useState, useEffect } from 'react';
import { SidebarState, AppMode } from '../types';
import { Star, FolderOpen, Globe, Book, Settings, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { IconButton } from './ui/Primitives';
import AppIcon from './AppIcon';

// --- Types & Constants ---
interface AppShellProps {
  // Slots
  children: React.ReactNode;        // Main Workspace (PaneGrid)
  navigationPanel: React.ReactNode; // Rendered Navigation
  widgetPanel: React.ReactNode;     // Rendered WidgetBar
  
  // State
  sidebarState: SidebarState;
  onSidebarChange: (state: Partial<SidebarState>) => void;
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  
  // Metadata
  unresolvedCount: number;
  onSettingsOpen: () => void;
}

// --- Helper: Resizer Component ---
const Resizer: React.FC<{ 
    onMouseDown: (e: React.MouseEvent) => void, 
    side: 'left' | 'right' 
}> = ({ onMouseDown, side }) => (
    <div 
        className={`absolute top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize z-50 flex flex-col justify-center items-center group transition-all bg-transparent hover:bg-accent2 active:bg-accent ${side === 'left' ? 'left-0 -ml-0.5' : 'right-0 -mr-0.5'}`}
        onMouseDown={onMouseDown}
    >
       <div className="h-8 w-0.5 bg-border group-hover:bg-accent/50 rounded-full transition-colors" />
    </div>
);

// --- Helper: Reopen Button ---
const ReopenTrigger: React.FC<{
    onClick: () => void,
    side: 'left' | 'right',
    icon: React.ElementType,
    badgeCount?: number
}> = ({ onClick, side, icon: Icon, badgeCount }) => (
    <button
        onClick={onClick}
        className={`absolute top-4 ${side === 'left' ? 'left-0 rounded-r-md border-l-0' : 'right-0 rounded-l-md border-r-0'} p-1.5 bg-panel border border-border text-text2 hover:text-accent hover:bg-panel2 shadow-soft z-40 transition-all group`}
    >
        <div className="relative">
            <Icon size={16} />
            {badgeCount && badgeCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-3 w-3 items-center justify-center rounded-full bg-danger text-[8px] text-white font-bold animate-pulse">
                    {badgeCount > 9 ? '9+' : badgeCount}
                </span>
            )}
        </div>
    </button>
);

const AppShell: React.FC<AppShellProps> = ({ 
    children, navigationPanel, widgetPanel, 
    sidebarState, onSidebarChange, activeMode, onModeChange,
    unresolvedCount, onSettingsOpen
}) => {
  // Local state for smooth resizing
  const [navWidth, setNavWidth] = useState(sidebarState.navWidth);
  const [isNavCollapsed, setIsNavCollapsed] = useState(sidebarState.navCollapsed);
  const [widgetWidth, setWidgetWidth] = useState(sidebarState.widgetWidth);
  const [isWidgetCollapsed, setIsWidgetCollapsed] = useState(sidebarState.widgetCollapsed);
  
  const [isResizingNav, setIsResizingNav] = useState(false);
  const [isResizingWidget, setIsResizingWidget] = useState(false);

  // Sync props to local state (for external updates)
  useEffect(() => { setNavWidth(sidebarState.navWidth); }, [sidebarState.navWidth]);
  useEffect(() => { setIsNavCollapsed(sidebarState.navCollapsed); }, [sidebarState.navCollapsed]);
  useEffect(() => { setWidgetWidth(sidebarState.widgetWidth); }, [sidebarState.widgetWidth]);
  useEffect(() => { setIsWidgetCollapsed(sidebarState.widgetCollapsed); }, [sidebarState.widgetCollapsed]);

  // Debounced/Effect sync back to parent
  useEffect(() => { onSidebarChange({ navWidth }); }, [navWidth]);
  useEffect(() => { onSidebarChange({ navCollapsed: isNavCollapsed }); }, [isNavCollapsed]);
  useEffect(() => { onSidebarChange({ widgetWidth }); }, [widgetWidth]);
  useEffect(() => { onSidebarChange({ widgetCollapsed: isWidgetCollapsed }); }, [isWidgetCollapsed]);

  // Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (isResizingNav) {
            const newWidth = Math.max(200, Math.min(e.clientX - 48, 600)); // 48 is function bar width
            setNavWidth(newWidth);
        }
        if (isResizingWidget) {
            const newWidth = Math.max(250, Math.min(window.innerWidth - e.clientX, 600));
            setWidgetWidth(newWidth);
        }
    };

    const handleMouseUp = () => {
        setIsResizingNav(false);
        setIsResizingWidget(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    };

    if (isResizingNav || isResizingWidget) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingNav, isResizingWidget]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text font-sans">
        
        {/* FUNCTION BAR */}
        <aside className="w-[48px] flex-none flex flex-col items-center py-4 gap-4 z-50 bg-panel border-r border-border">
             <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center mb-4 shadow-glow">
                 <AppIcon icon={Star} size={16} className="text-white fill-white" />
             </div>
             
             {/* Mode Switchers */}
             <IconButton active={activeMode === 'notes'} onClick={() => onModeChange('notes')} title="Notes Mode"><FolderOpen size={20}/></IconButton>
             <IconButton active={activeMode === 'starmap'} onClick={() => onModeChange('starmap')} title="Star Map Mode"><Globe size={20}/></IconButton>
             <IconButton active={activeMode === 'glossary'} onClick={() => onModeChange('glossary')} title="Glossary Mode"><Book size={20}/></IconButton>
             
             <div className="flex-1" />
             <IconButton onClick={onSettingsOpen} title="Settings"><Settings size={20}/></IconButton>
        </aside>

        {/* NAVIGATION RAIL */}
        <aside 
            className="flex-none flex flex-col relative group/nav border-r border-border bg-panel"
            style={{ 
                width: isNavCollapsed ? 0 : navWidth, 
                transition: isResizingNav ? 'none' : 'width 300ms ease',
                minWidth: isNavCollapsed ? 0 : undefined 
            }}
        >
            <div className={`flex flex-col h-full overflow-hidden ${isNavCollapsed ? 'invisible' : 'visible'}`}>
                {navigationPanel}
                
                {activeMode === 'notes' && (
                    <div className="absolute bottom-2 right-2">
                        <IconButton size="sm" onClick={() => setIsNavCollapsed(true)} title="Collapse"><PanelLeftClose size={14}/></IconButton>
                    </div>
                )}
            </div>
            {!isNavCollapsed && <Resizer onMouseDown={(e) => { e.preventDefault(); setIsResizingNav(true); }} side="right" />}
        </aside>

        {/* WORKSPACE */}
        <main className="flex-1 flex flex-col min-w-0 relative bg-bg overflow-hidden">
             {isNavCollapsed && <ReopenTrigger onClick={() => setIsNavCollapsed(false)} side="left" icon={PanelLeftOpen} badgeCount={unresolvedCount} />}
             <div className="flex-1 relative overflow-hidden">{children}</div>
             {isWidgetCollapsed && <ReopenTrigger onClick={() => setIsWidgetCollapsed(false)} side="right" icon={PanelRightOpen} />}
        </main>

        {/* WIDGET RAIL */}
        <aside 
            className="flex-none flex flex-col overflow-hidden relative border-l border-border bg-panel"
            style={{ 
                width: isWidgetCollapsed ? 0 : widgetWidth, 
                transition: isResizingWidget ? 'none' : 'width 300ms ease',
                minWidth: isWidgetCollapsed ? 0 : undefined 
            }}
        >
             {!isWidgetCollapsed && <Resizer onMouseDown={(e) => { e.preventDefault(); setIsResizingWidget(true); }} side="left" />}
             <div className={`flex flex-col h-full overflow-hidden ${isWidgetCollapsed ? 'invisible' : 'visible'}`}>
                 <div className="h-10 flex-shrink-0 flex items-center justify-between px-4 border-b border-border bg-panel">
                     <span className="text-[0.7rem] font-bold tracking-widest text-text2 uppercase">Helper</span>
                     <IconButton size="sm" onClick={() => setIsWidgetCollapsed(true)}><PanelRightClose size={14}/></IconButton>
                 </div>
                 <div className="flex-1 overflow-hidden">
                     {widgetPanel}
                 </div>
             </div>
        </aside>
    </div>
  );
};

export default AppShell;
