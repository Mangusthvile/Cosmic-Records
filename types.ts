
export type ID = string; // uuid
export type ISODate = string; // legacy support if needed, but moving to number for Note
export type Timestamp = number; // Date.now()

// Updated Note Status per Milestone 4
export type NoteStatus = "Draft" | "Canon" | "Experimental" | "Outdated" | "Archived";
export type NoteType = "General" | "Character" | "Place" | "Item" | "Event" | "Lore" | "Canvas";

export type UniverseTagID = ID;
export type TagID = ID;
export type GlossaryTermID = ID;
export type TemplateID = ID;
export type MapNodeID = ID;
export type NotificationID = ID;

export type WidgetId = 'outline' | 'backlinks' | 'glossary' | 'ai_chat' | 'notifications';

export interface UserPreferences {
  ai: { proactive: boolean; allow_auto_edits: boolean; remember_preferences: boolean };
  tts: { mode: string };
  ui: { gray_out_outdated_titles: boolean; show_badges_in_search: boolean; show_unresolved_prominently: boolean };
}

// --- CANONICAL DISK SCHEMA (Step 1: Canonical Metadata) ---

export interface UnresolvedOrigin {
    sourceNoteId: string;
    sourceNoteTitle: string;
    createdAt: number;
}

export interface DiskNote {
  schemaVersion: number; // bumped to 2
  noteId: string;
  meta: {
    title: string;
    type: string; // NoteType
    status: NoteStatus;
    unresolved: boolean;
    universeTag: string | null;
    createdAt: number;
    updatedAt: number;
    folderPath: string; // Relative to vault root e.g. "Characters"
    pinned: boolean;
    tags?: string[];
  };
  properties: {
    custom: Record<string, any>;
    system: {
      showOnStarMap?: boolean;
      unresolvedOrigins?: UnresolvedOrigin[];
      [key: string]: any;
    };
  };
  content: {
    format: 'tiptap';
    version: number; // 2
    doc: any; // TipTap JSON
  };
  modules: any[]; 
  links: {
    outgoing: any[];
    incoming: any[];
  };
}

export interface IndexEntry {
    noteId: string;
    filePath: string; 
    folderPath: string; 
    fileName: string;
    title: string;
    type: string;
    status: NoteStatus;
    unresolved: boolean;
    universeTag: string | null;
    tags: string[];
    pinned: boolean;
    createdAt: number;
    updatedAt: number;
    excerpt: string; 
    folderId: string; // Mapped at runtime for convenience
    outboundLinks?: string[]; 
}

export interface IndexData {
    schemaVersion: number;
    updatedAt: number;
    notes: Record<string, IndexEntry>;
}

// --- CONFIGURATION SCHEMAS ---

export interface ValidationRule {
    id: string;
    enabled: boolean;
    scope: string; 
    kind: "requiredField" | "warning" | "custom";
    data: any;
}

export interface SettingsData {
    schemaVersion: number;
    updatedAt: number;
    ui: {
        theme: string;
        reduceMotion: boolean;
    };
    universeTags: {
        tags: string[];
        defaultTag: string | null;
    };
    notes: {
        defaultFolderId: string;
        defaultStatus: NoteStatus;
        renameUpdatesWikiLinks: boolean;
    };
    validation: {
        strictMode: boolean;
        rules: ValidationRule[];
    };
}

export interface NoteTemplate {
    templateId: string;
    name: string;
    kind: "blank" | "structured";
    contentBlocks: any[];
}

export interface AIInterviewTemplate {
    templateId: string;
    name: string;
    questions: { id: string; text: string; kind: string; options?: string[] }[];
    outputPlan: any;
}

export interface NoteTypeDefinition {
    typeId: string; 
    name: string;
    defaultTemplateId: string;
    templates: NoteTemplate[];
    aiInterviewTemplates: AIInterviewTemplate[];
    icon?: string; 
    description?: string; 
}

export interface TemplatesData {
    schemaVersion: number;
    updatedAt: number;
    noteTypes: NoteTypeDefinition[];
    lastUsed: {
        typeId: string;
    };
}

export interface KeyBinding {
    command: string;
    keys: string;
    enabled: boolean;
    label?: string; 
}

export interface HotkeysData {
    schemaVersion: number;
    updatedAt: number;
    bindings: KeyBinding[];
}

export interface MapData {
    mapId: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    viewState: { zoom: number; panX: number; panY: number };
    nodes: any[];
    areas: any[];
}

export interface MapsData {
    schemaVersion: number;
    updatedAt: number;
    maps: Record<string, MapData>;
}

export interface CollectionsData {
    schemaVersion: number;
    updatedAt: number;
    collections: Record<ID, Collection>;
}

// --- SEARCH TYPES ---
export interface SearchFilters {
    folderId: string | 'all';
    collectionId?: string | 'all'; // Added collection filtering
    includeSubfolders: boolean;
    universeTagId: string | 'all' | 'none';
    type: string | 'all';
    status: string | 'all';
    unresolved: 'all' | 'unresolved' | 'resolved'; 
}

// --- PANE SYSTEM TYPES ---
export type PaneLayout = 'single' | 'splitVertical' | 'splitHorizontal' | 'grid';
export type PaneId = 'paneA' | 'paneB' | 'paneC' | 'paneD';

export type TabKind = 'note' | 'starmap' | 'glossary' | 'missing';

export interface TabBase {
  id: string; 
  kind: TabKind;
  title: string;
  icon?: string;
  version: number;
  lastActiveAt?: ISODate;
}

export interface NoteTabState {
  readMode: boolean;
  scrollY?: number;
}
export interface NoteTab extends TabBase {
  kind: 'note';
  payload: {
    noteId: string;
  };
  state: NoteTabState;
}

export interface StarMapTabState {
  zoom: number;
  panX: number;
  panY: number;
  selectedNodeId: string | null;
}
export interface StarMapTab extends TabBase {
  kind: 'starmap';
  payload: {
    mapId: string | "main";
  };
  state: StarMapTabState;
}

export interface GlossaryTabState {
  search: string;
  selectedTermId: string | null;
  scrollY: number;
}
export interface GlossaryTab extends TabBase {
  kind: 'glossary';
  payload: {
    scope: "all";
  };
  state: GlossaryTabState;
}

export interface MissingTab extends TabBase {
  kind: 'missing';
  payload: {
    originalKind: string;
    originalId?: string;
    lastKnownTitle?: string;
  };
  state: any;
}

export type Tab = NoteTab | StarMapTab | GlossaryTab | MissingTab;

export interface PaneState {
  id: PaneId;
  tabs: Tab[];
  activeTabId: string | null;
  history: string[]; 
}

export interface PaneSystemState {
  layout: PaneLayout;
  focusedPaneId: PaneId;
  panes: Record<PaneId, PaneState>;
}

// --- UI PERSISTENCE TYPES ---

export interface SidebarState {
    navWidth: number;
    navCollapsed: boolean;
    widgetWidth: number;
    widgetCollapsed: boolean;
}

export interface NavigationState {
    selectedSection: string | null; 
    folderOpenState: Record<string, boolean>;
    searchState?: {
        query: string;
        filters: SearchFilters;
        isFiltersOpen: boolean;
    };
}

export interface WidgetSystemState {
    openWidgetIds: string[];
    widgetStates: Record<string, any>; 
}

export interface UIState {
    schemaVersion: number;
    savedAt: number;
    paneSystem: PaneSystemState;
    layout: SidebarState;
    navigation: NavigationState;
    widgets: WidgetSystemState;
}

// --- WORKSPACE ---

export interface Workspace {
  schema_version: "1.0";
  workspace_id: ID;
  name: string;

  notes: Record<ID, Note>;
  folders: Record<ID, Folder>;
  collections: Record<ID, Collection>; 
  pinnedNoteIds: ID[]; 
  
  // Persisted Configs
  settings: SettingsData;
  templates: TemplatesData;
  hotkeys: HotkeysData;
  maps: MapsData;

  // Legacy
  tags: Record<TagID, Tag>;
  glossary: {
    terms: Record<GlossaryTermID, GlossaryTerm>;
    extraction_queue: GlossaryExtractionItem[];
  };
  
  // Runtime Indexes
  indexes: {
    title_to_note_id: Record<string, ID>;
    unresolved_note_ids: ID[];
    outdated_note_ids: ID[];
    backlinks: Record<ID, ID[]>; 
    note_files?: Record<ID, { fileName: string, folderPath: string }>; 
  };
  
  notifications: Record<NotificationID, Notification>;
  notificationLog: NotificationLogItem[]; 
  user_preferences: any; 

  created_at: ISODate;
  updated_at: ISODate;
}

export interface Note {
  id: ID;
  title: string; 
  type: string; // NoteType
  status: NoteStatus;
  
  unresolved: boolean;
  unresolvedSources?: string[]; 
  universeTag: string | null; 
  folderId: string; 
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  content: any; // TipTap JSON
  excerpt?: string; 
  pinned: boolean; 
  
  metadata?: any; 
  system?: any; 
  aiInterview?: any; 
  
  tag_ids: TagID[];
  content_plain?: string; 
  
  outbound_note_ids?: string[];
}

export interface Folder {
  id: ID;
  name: string;
  type: 'system' | 'user';
  parentId: ID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  order: number;
}

export interface Collection {
    id: ID;
    name: string;
    noteIds: ID[]; // References to notes, NO duplication
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Tag {
  id: TagID;
  name: string;      
  color: string | null;
  created_at: ISODate;
}

export interface UniverseTag {
  id: UniverseTagID;
  name: string;      
  color: string | null;
  created_at: ISODate;
}

export interface GlossaryTerm {
  id: GlossaryTermID;
  term: string;                 
  definition_rich: any;
  definition_plain: string;
  referenced_term_ids: GlossaryTermID[];
  universe_tag_ids: UniverseTagID[]; 
  sources: {
    originating_note_ids: ID[]; 
  };
  created_at: ISODate;
  updated_at: ISODate;
}

export interface GlossaryExtractionItem {
  id: ID;
  raw_term: string;
  found_in_note_id: ID;
  context_snippet: string;
  created_at: ISODate;
}

export interface Notification {
  id: NotificationID;
  kind: string;
  severity: string;
  title: string;
  message: string;
  related_note_ids: ID[];
  created_at: ISODate;
  read: boolean;
  dismissed: boolean;
}

export interface NotificationLogItem {
    id: string;
    timestamp: number;
    type: "statusChange" | "system" | "warning" | "info" | "success";
    message: string;
    relatedNoteId?: string;
    read: boolean;
}