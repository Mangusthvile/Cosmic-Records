
import React from 'react';
import { WidgetId, Workspace, Tab } from '../../types';
import { List, Link2, Book, Sparkles, Bell, Dices, Coins } from 'lucide-react';
import OutlineWidget from './OutlineWidget';
import BacklinksWidget from './BacklinksWidget';
import GlossaryWidget from './GlossaryWidget';
import AIChatWidget from './AIChatWidget';
import NotificationsWidget from './NotificationsWidget';
import DiceRollWidget from './DiceRollWidget';
import CoinFlipWidget from './CoinFlipWidget';

export interface WidgetProps {
    workspace: Workspace;
    activeNoteId: string | null;
    activeTab: Tab | undefined;
    onOpenNote: (id: string) => void;
    onUpdateWorkspace: (ws: Workspace) => void;
    state: any;
    onStateChange: (newState: any) => void;
}

export interface WidgetDefinition {
    id: WidgetId;
    title: string;
    icon: React.ElementType;
    component: React.FC<WidgetProps>;
    defaultState: any;
    description: string;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetDefinition> = {
    outline: {
        id: 'outline',
        title: 'Outline',
        icon: List,
        component: OutlineWidget,
        defaultState: {},
        description: 'Table of contents for current note.'
    },
    backlinks: {
        id: 'backlinks',
        title: 'Connections',
        icon: Link2,
        component: BacklinksWidget,
        defaultState: {},
        description: 'Incoming and outgoing links.'
    },
    glossary: {
        id: 'glossary',
        title: 'Glossary',
        icon: Book,
        component: GlossaryWidget,
        defaultState: { search: '', view: 'search' },
        description: 'Search and define terms.'
    },
    ai_chat: {
        id: 'ai_chat',
        title: 'AI Assistant',
        icon: Sparkles,
        component: AIChatWidget,
        defaultState: { history: [] },
        description: 'Chat with the archives.'
    },
    notifications: {
        id: 'notifications',
        title: 'System Log',
        icon: Bell,
        component: NotificationsWidget,
        defaultState: {},
        description: 'Recent system events.'
    },
    dice: {
        id: 'dice',
        title: 'Dice Roller',
        icon: Dices,
        component: DiceRollWidget,
        defaultState: { history: [] },
        description: 'Roll polyhedral dice.'
    },
    coinflip: {
        id: 'coinflip',
        title: 'Coin Flip',
        icon: Coins,
        component: CoinFlipWidget,
        defaultState: { history: [] },
        description: 'Heads or tails.'
    }
};

export const AVAILABLE_WIDGETS = Object.values(WIDGET_REGISTRY);
