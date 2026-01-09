
export type ID = string; // uuid
export type ISODate = string; // legacy support if needed, but moving to number for Note
export type Timestamp = number; // Date.now()

// Updated Note Status as per Step 6
export type NoteStatus = "Draft" | "Canon" | "Experimental" | "Outdated" | "Archived";
export type NoteType = "General" | "Character" | "Place" | "Item" | "Event" | "Lore";

export type UniverseTagID = ID;
export type TagID = ID;
export type GlossaryTermID = ID;
export type TemplateID = ID;
export type MapNodeID = ID;
export type NotificationID = ID;

// --- CANONICAL DISK SCHEMA (Step 3) ---

export interface NoteBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'list' | 'quote' | 'code' | 'divider';
  text: string;
  attrs?: Record<string, any>;
  marks?: any[]; // Reserved for future rich text marks
}

export interface UnresolvedOrigin {
    sourceNoteId: string;
    sourceNoteTitle: string;
    createdAt: number;
}

export interface DiskNote {
  schemaVersion: number;
  noteId: string;
  meta: {
    title: string;
    type: string;
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
    format: 'blocks';
    blocks: NoteBlock[];
  };
  modules: any[]; // Reserved for structured modules
  links: {
    outgoing: any[];
    incoming: any[];
  };
}

export interface IndexEntry {
    noteId: string;
    filePath: string; // Relative path to json file
    folderPath: string; // Relative path to folder
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
    excerpt: string; // Short snippet
    folderId: string; // Mapped at runtime for convenience, derived from folderPath
}

export interface IndexData {
    schemaVersion: number;
    updatedAt: number;
    notes: Record<string, IndexEntry>;
}

// --- CONFIGURATION SCHEMAS (Step 7) ---

// 1. Settings
export interface ValidationRule {
    id: string;
    enabled: boolean;
    scope: string; // e.g. "global", "type:Character"
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

// 2. Templates
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
    typeId: string; // e.g. "General", "Character"
    name: string;
    defaultTemplateId: string;
    templates: NoteTemplate[];
    aiInterviewTemplates: AIInterviewTemplate[];
    icon?: string; // Optional UI hint
    description?: string; // Optional UI hint
}

export interface TemplatesData {
    schemaVersion: number;
    updatedAt: number;
    noteTypes: NoteTypeDefinition[];
    lastUsed: {
        typeId: string;
    };
}

// 3. Hotkeys
export interface KeyBinding {
    command: string;
    keys: string;
    enabled: boolean;
    label?: string; // For UI display
}

export interface HotkeysData {
    schemaVersion: number;
    updatedAt: number;
    bindings: KeyBinding[];
}

// 4. Maps
export interface MapNodeStyle {
    shape: "circle" | "ring" | "bubble" | "symbol";
    icon: string;
    color: string;
}

export interface MapNodeData {
    id: string;
    noteId: string; // Link to note
    x: number;
    y: number;
    style: MapNodeStyle;
}

export interface MapData {
    mapId: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    viewState: { zoom: number; panX: number; panY: number };
    nodes: MapNodeData[];
    areas: any[];
}

export interface MapsData {
    schemaVersion: number;
    updatedAt: number;
    maps: Record<string, MapData>;
}

// --- WIDGET TYPES ---
export type WidgetId = 'outline' | 'backlinks' | 'glossary' | 'ai_chat' | 'notifications';

export interface WidgetSystemState {
    openWidgetIds: WidgetId[];
    widgetStates: Record<string, any>; // Keyed by WidgetId
}

// --- SEARCH TYPES ---
export interface SearchFilters {
    folderId: string | 'all';
    includeSubfolders: boolean;
    universeTagId: string | 'all' | 'none';
    type: string | 'all';
    status: string | 'all';
    unresolved: 'all' | 'unresolved' | 'resolved'; // Enhanced from boolean
}

// --- PANE SYSTEM TYPES ---
export type PaneLayout = 'single' | 'splitVertical' | 'splitHorizontal' | 'grid';
export type PaneId = 'paneA' | 'paneB' | 'paneC' | 'paneD';

// Tab Kinds
export type TabKind = 'note' | 'starmap' | 'glossary' | 'missing';

// Base Tab
export interface TabBase {
  id: string; // uuid
  kind: TabKind;
  title: string;
  icon?: string;
  version: number;
  lastActiveAt?: ISODate;
}

// 1. Note Tab
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

// 2. Star Map Tab
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

// 3. Glossary Tab
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

// 4. Missing Tab (Placeholder for broken references)
export interface MissingTab extends TabBase {
  kind: 'missing';
  payload: {
    originalKind: string;
    originalId?: string;
    lastKnownTitle?: string;
  };
  state: any;
}

// Universal Tab Union
export type Tab = NoteTab | StarMapTab | GlossaryTab | MissingTab;

export interface PaneState {
  id: PaneId;
  tabs: Tab[];
  activeTabId: string | null;
  history: string[]; // array of tab IDs, most recent last
}

export interface PaneSystemState {
  layout: PaneLayout;
  focusedPaneId: PaneId;
  panes: Record<PaneId, PaneState>;
}

// --- LAYOUT & UI PERSISTENCE TYPES ---

export interface SidebarState {
    navWidth: number;
    navCollapsed: boolean;
    widgetWidth: number;
    widgetCollapsed: boolean;
}

export interface NavigationState {
    selectedSection: string | null; // e.g. 'pinned', 'inbox', 'folder:123'
    folderOpenState: Record<string, boolean>;
    searchState?: {
        query: string;
        filters: SearchFilters;
        isFiltersOpen: boolean;
    };
}

export interface UIState {
    schemaVersion: number;
    savedAt: number;
    paneSystem: PaneSystemState;
    layout: SidebarState;
    navigation: NavigationState;
    widgets: WidgetSystemState;
}

// -------------------------

// 1. Workspace Root (Adapted for Vault Storage)
export interface Workspace {
  schema_version: "1.0";
  workspace_id: ID;
  name: string;

  notes: Record<ID, Note>;
  folders: Record<ID, Folder>;
  collections: Record<ID, Collection>; // Shortcut groups
  pinnedNoteIds: ID[]; // Legacy: Kept for compat
  
  // Configuration & Metadata (Persisted Files)
  settings: SettingsData;
  templates: TemplatesData;
  hotkeys: HotkeysData;
  maps: MapsData;

  // Legacy/Other entities (kept for compatibility or specific module data)
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
    backlinks: Record<ID, ID[]>; // targetNoteId -> list of sourceNoteIds
    note_files?: Record<ID, { fileName: string, folderPath: string }>; // In-memory index for file resolution
  };
  
  notifications: Record<NotificationID, Notification>;
  notificationLog: NotificationLogItem[]; 
  user_preferences: UserPreferences; // Kept for legacy compat, but source is settings.json

  created_at: ISODate;
  updated_at: ISODate;
}

// 2. Core Note Model (Step 6)
export interface Note {
  id: ID;
  title: string; // unique
  type: string; // NoteType string value
  status: NoteStatus;
  
  unresolved: boolean;
  unresolvedSources?: string[]; // IDs of notes that spawned this unresolved note
  universeTag: string | null; // Name string or null
  folderId: string; // default Inbox
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  content: string; // Runtime string content (mapped to blocks on disk)
  excerpt?: string; // Short preview text (from index)
  pinned: boolean; // From index
  
  // Optional / Legacy / Metadata
  metadata?: any; 
  system?: any; // System properties like unresolvedOrigins
  aiInterview?: AIInterviewState; // Stub for AI flow
  
  // Visuals (Legacy support)
  theme?: NoteTheme | null;
  cover_image?: string | null;
  
  // Legacy fields to be deprecated or mapped
  tag_ids: TagID[];
  universe_tag_id?: UniverseTagID | null; // Legacy mapped
  content_plain?: string; // Mapped to content
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
    noteIds: ID[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface AIInterviewState {
  isActive: boolean;
  step: 'start' | 'interview' | 'generating' | 'complete';
  transcript: { role: 'ai' | 'user', text: string }[];
}

export interface NoteTheme {
  backgroundColor?: string;
  panelColor?: string; 
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  backgroundImage?: string;
  overlayOpacity?: number; // 0.0 to 1.0
}

// Minimal RichDoc contract (simulated as basic object for now)
export type RichDoc = { type: string; content: any };

export interface OutgoingLink {
  raw: string;            
  target_title: string;   
  display_text: string;   
  target_note_id: ID;     
  target_status: NoteStatus | null; 
  target_unresolved: boolean;
}

export type NoteMetadata =
  | { kind: "general"; data: GeneralMeta }
  | { kind: "character"; data: CharacterMeta }
  | { kind: "place"; data: PlaceMeta };

export interface GeneralMeta {
    // Empty in v1
}

// 3. Character Data
export interface CharacterMeta {
  template_id: TemplateID | null;
  states: CharacterState[];
  active_state_id: ID;
  forms: CharacterForm[]; 
  active_form_id: ID | null;
  appearance: {
    description: string;
    generated_images: GeneratedImageRef[];
  };
  modules: Record<string, CharacterModuleInstance>;
  quick_build: {
    completed: boolean;
    last_questions: string[];
    last_answers: string[];
  };
}

export interface CharacterState {
  id: ID;
  label: string;          
  summary: string;        
  effective_overrides: {
    module_overrides: Record<string, any>;
  };
  created_at: ISODate;
}

export interface CharacterForm {
  id: ID;
  label: string;          
  summary: string;
  form_overrides: {
    module_overrides: Record<string, any>;
  };
  created_at: ISODate;
}

export interface CharacterModuleInstance {
  module_key: string;     
  version: string;        
  required: boolean;      
  data: any;              
}

export interface GeneratedImageRef {
  id: ID;
  provider: "local" | "external";
  uri: string;        
  created_at: ISODate;
  prompt_used: string;
}

// 4. Place Data
export type PlaceScale = "universe" | "galaxy" | "cluster" | "system" | "planet" | "nation" | "region" | "city" | "district" | "building" | "room";

export interface PlaceMeta {
  template_id: TemplateID | null;
  scale: PlaceScale;
  parent_place_note_id: ID | null;
  child_place_note_ids: ID[];
  timeline: TimelineEntry[];
  local_map: LocalMap | null;
  aggregates: {
    characters_originating_here: ID[]; 
    characters_located_here: ID[];     
  };
  modules: Record<string, PlaceModuleInstance>;
}

export interface TimelineEntry {
  id: ID;
  title: string;
  era_label: string;
  description: string;
  related_note_ids: ID[];
  created_at: ISODate;
}

export interface LocalMap {
  id: ID;
  kind: "canvas" | "nodes" | "grid";
  data: any;
}

export interface PlaceModuleInstance {
  module_key: string;
  version: string;
  required: boolean;
  data: any;
}

// 5. Tags
export interface Tag {
  id: TagID;
  name: string;      
  color: string | null;
  created_at: ISODate;
}

// Legacy Interface: kept but data source is now settings.universeTags
export interface UniverseTag {
  id: UniverseTagID;
  name: string;      
  color: string | null;
  created_at: ISODate;
}

// 6. Glossary
export interface GlossaryTerm {
  id: GlossaryTermID;
  term: string;                 
  definition_rich: RichDoc;
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

// 7. Templates
export interface CharacterTemplate {
  id: TemplateID;
  name: string;
  description: string;
  required_modules: string[]; 
  default_modules: Record<string, { version: string; data: any }>;
  validation_rule_ids: ID[];
  export_profile: {
    include_modules: string[];
  };
  created_at: ISODate;
  updated_at: ISODate;
}

export interface PlaceTemplate {
  id: TemplateID;
  name: string;
  description: string;
  required_modules: string[]; 
  default_modules: Record<string, { version: string; data: any }>;
  validation_rule_ids: ID[];
  created_at: ISODate;
  updated_at: ISODate;
}

// 10. Notifications
export interface Notification {
  id: NotificationID;
  kind: "contradiction" | "glossary_conflict" | "unresolved_link" | "validation_warning";
  severity: "info" | "warn" | "error";
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
    type: "statusChange" | "system" | "warning" | "info";
    message: string;
    relatedNoteId?: string;
    read: boolean;
}

// 11. User Preferences (Legacy - now in settings.json)
export interface UserPreferences {
  ai: {
    proactive: boolean;
    allow_auto_edits: boolean; 
    remember_preferences: boolean;
  };
  tts: {
    mode: "selected_text_only";
  };
  ui: {
    gray_out_outdated_titles: boolean;
    show_badges_in_search: boolean;
    show_unresolved_prominently: boolean;
  };
}
