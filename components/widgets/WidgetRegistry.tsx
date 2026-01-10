
import React from 'react';
import { WidgetId, Workspace, Tab } from '../../types';
import { List, Link2, Book, Sparkles, Bell, Dices, Coins, AlignLeft, Clock, MessageSquare } from 'lucide-react';
import OutlineWidget from './OutlineWidget';
import BacklinksWidget from './BacklinksWidget';
import GlossaryWidget from './GlossaryWidget';
import AIChatWidget from './AIChatWidget';
import NotificationsWidget from './NotificationsWidget';
import DiceRollWidget from './DiceRollWidget';
import CoinFlipWidget from './CoinFlipWidget';
import DefinitionWidget from './DefinitionWidget';
import PendingReviewWidget from './PendingReviewWidget';
import TermOccurrencesWidget from './TermOccurrencesWidget';

export interface WidgetProps {
    workspace: Workspace;
    activeNoteId: string | null;
    activeTab: Tab | undefined;
    onOpenNote: (id: string) => void;
    onOpenTerm: (id: string) => void;
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
    group: 'General' | 'Glossary' | 'Tools';
}

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
    outline: {
        id: 'outline',
        title: 'Outline',
        icon: List,
        component: OutlineWidget,
        defaultState: {},
        description: 'Table of contents for current note.',
        group: 'General'
    },
    backlinks: {
        id: 'backlinks',
        title: 'Connections',
        icon: Link2,
        component: BacklinksWidget,
        defaultState: {},
        description: 'Incoming and outgoing links.',
        group: 'General'
    },
    definition: {
        id: 'definition',
        title: 'Definition',
        icon: AlignLeft,
        component: DefinitionWidget,
        defaultState: { selectedTermId: null },
        description: 'View full glossary definition.',
        group: 'Glossary'
    },
    pending_review: {
        id: 'pending_review',
        title: 'Pending Review',
        icon: Clock,
        component: PendingReviewWidget,
        defaultState: { selectedPendingId: null },
        description: 'Review and approve new terms.',
        group: 'Glossary'
    },
    term_occurrences: {
        id: 'term_occurrences',
        title: 'Mentions',
        icon: MessageSquare,
        component: TermOccurrencesWidget,
        defaultState: { selectedTermId: null },
        description: 'See where terms appear.',
        group: 'Glossary'
    },
    glossary: {
        id: 'glossary',
        title: 'Glossary Search',
        icon: Book,
        component: GlossaryWidget,
        defaultState: { search: '', view: 'search' },
        description: 'Search and define terms.',
        group: 'Glossary'
    },
    ai_chat: {
        id: 'ai_chat',
        title: 'AI Assistant',
        icon: Sparkles,
        component: AIChatWidget,
        defaultState: { history: [] },
        description: 'Chat with the archives.',
        group: 'General'
    },
    notifications: {
        id: 'notifications',
        title: 'System Log',
        icon: Bell,
        component: NotificationsWidget,
        defaultState: {},
        description: 'Recent system events.',
        group: 'Tools'
    },
    dice: {
        id: 'dice',
        title: 'Dice Roller',
        icon: Dices,
        component: DiceRollWidget,
        defaultState: { history: [] },
        description: 'Roll polyhedral dice.',
        group: 'Tools'
    },
    coinflip: {
        id: 'coinflip',
        title: 'Coin Flip',
        icon: Coins,
        component: CoinFlipWidget,
        defaultState: { history: [] },
        description: 'Heads or tails.',
        group: 'Tools'
    }
};

export const AVAILABLE_WIDGETS = Object.values(WIDGET_REGISTRY);
