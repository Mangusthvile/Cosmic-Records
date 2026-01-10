

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

export type WidgetId = 'outline' | 'backlinks' | 'glossary' | 'ai_chat' | 'notifications' | 'dice' | 'coinflip' | 'definition' | 'pending_review' | 'term_occurrences';

export interface UserPreferences {
  ai: { proactive: boolean; allow_auto_edits: boolean; remember_preferences: boolean };
  tts: { mode: string };
  ui: { gray_out_outdated_titles: boolean; show_badges_in_search: boolean; show_unresolved_prominently: boolean };
  widgets: { autoOpenRecommended: boolean };
}

// --- CANONICAL DISK SCHEMA ---

export interface UnresolvedOrigin {
    sourceNoteId: string;
    sourceNoteTitle: string;
    createdAt: number;
}

// Milestone 6: Character Block Schema

export type CharacterBlockType = 
    | 'identity' 
    | 'summary' 
    | 'appearance' 
    | 'personality' 
    | 'stats' 
    | 'abilities' 
    | 'items' 
    | 'relationships' 
    | 'history' 
    | 'locations' 
    | 'tags' 
    | 'authorNotes'
    | 'unknown'
    // Legacy types from Step 1 for migration safety (optional, but good practice)
    | 'text' | 'keyValue' | 'statGrid' | 'meter';

export interface CharacterBlock {
    blockId: string;
    type: CharacterBlockType;
    title: string;
    collapsed: boolean;
    payload: any; // Type-specific payload handled by registry
}

// -- Block Payloads (Canonical) --

export interface IdentityPayload {
    fields: Array<{ key: string; value: string }>;
}

export interface RichTextPayload {
    doc: any; // TipTap doc JSON
}

export interface StatsPayload {
    stats: Array<{ name: string; value: number; max?: number }>;
}

export interface AbilitiesPayload {
    abilities: Array<{ name: string; descriptionDoc?: any; tags?: string[] }>;
}

export interface ItemsPayload {
    items: Array<{ name: string; qty: number; notes?: string }>;
}

export interface ReferencePayload {
    links: Array<{ targetNoteId: string; label?: string; relation?: string }>;
}

export interface TagsPayload {
    tags: string[];
}

// Milestone 6 Step 7: Structured Refs
export interface LocationsPayload {
  schemaVersion: 1;
  originPlaceId: string | null;
  currentPlaceId: string | null;
  otherPlaces: Array<{
    id: string; // row id
    placeId: string;
    label?: string;
    from?: string;
    to?: string;
    notesDoc?: any;
  }>;
}

export interface RelationshipItem {
    relId: string;
    targetCharacterId: string;
    type: string;
    direction?: "to" | "from" | "mutual";
    strength?: number; // 1-5
    status?: string;
    notesDoc?: any;
    tags?: string[];
}

export interface RelationshipsPayload {
  schemaVersion: 1;
  relationships: RelationshipItem[];
}

// Legacy Payloads for characterBlocks.ts
export interface TextBlockPayload { doc: any; }
export interface KeyValueBlockPayload { fields: Array<{ key: string; value: string }>; }
export interface StatGridBlockPayload { columns: string[]; rows: any[]; }
export interface MeterBlockPayload { items: any[]; }

// --- TEMPLATES ---
export type TemplateKind = 'character';

export type MappingRuleType = 'setField' | 'appendList' | 'richTextFrom';

export interface InterviewMappingRule {
    type: MappingRuleType;
    moduleType: CharacterBlockType;
    field?: string;
    listField?: string;
    richTextField?: string;
    fromAnswerId: string;
}

export interface InterviewQuestion {
    id: string;
    prompt: string; 
    help?: string;
    type: "shortText" | "longText" | "number" | "singleSelect" | "multiSelect" | "boolean";
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    defaultValue?: any;
    targetHint?: { moduleType?: CharacterBlockType; field?: string };
    
    // Legacy support for M4 compatibility if needed (can be optional)
    text?: string; 
    kind?: string;
}

export interface InterviewDefinition {
    version: number;
    title: string;
    intro?: string;
    questions: InterviewQuestion[];
    mapping: InterviewMappingRule[];
}

export interface CharacterTemplate {
    schemaVersion: number;
    templateId: string;
    kind: TemplateKind;
    name: string;
    description?: string;
    strictMode: boolean; // Milestone 6 Step 8
    requiredModules: CharacterBlockType[];
    suggestedModules: CharacterBlockType[];
    defaultOrder: CharacterBlockType[];
    moduleDefaults: Partial<Record<CharacterBlockType, {
        title?: string;
        collapsed?: boolean;
        fieldHints?: Record<string, string>;
    }>>;
    validationHooks?: {
        onSave?: Array<{ id: string; message: string; level: 'warn' | 'error' }>;
    };
    interview?: InterviewDefinition;
    // Milestone 6 Step 8: Validation Rules
    validation?: {
        requiredIdentityFields?: string[];
        statRanges?: {
            perStat?: Record<string, { min: number, max: number }>;
        };
        requireNonUnresolvedPlaces?: boolean;
        customWarnings?: Array<{
            id: string;
            label: string;
            ruleType: "fieldRequired";
            moduleType: string;
            fieldPath: string;
            message: string;
        }>;
    };
}

export interface TemplatesIndex {
    schemaVersion: number;
    updatedAt: number;
    templates: Array<{
        templateId: string;
        kind: TemplateKind | 'note' | 'other';
        name: string;
        description?: string;
        file: string;
    }>;
}

// Milestone 6 Step 6: Multi-state Character Data

export interface ModuleOverride {
    schemaVersion: 1;
    payload?: any;
    title?: string;
    collapsed?: boolean;
    deleted?: boolean;
}

export interface CharacterForm {
    formId: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    overrides: Record<string, ModuleOverride>; // Keyed by blockId
    localBlocks: CharacterBlock[]; // Modules exclusive to this form
    meta?: { color?: string };
}

export interface CharacterSnapshot {
    snapshotId: string;
    label: string;
    formId: string;
    date?: string;
    createdAt: number;
    resolved: {
        templateId: string;
        blocks: CharacterBlock[]; // Frozen resolved blocks
    };
}

export interface CharacterData {
    templateId: string;
    blocks: CharacterBlock[]; // Base blocks
    forms: {
        schemaVersion: 1;
        activeFormId: string;
        order: string[];
        items: Record<string, CharacterForm>;
    };
    snapshots: {
        schemaVersion: 1;
        activeSnapshotId?: string | null;
        order: string[];
        items: Record<string, CharacterSnapshot>;
    };
    // Legacy support fields (can be removed after full migration, or kept optional)
    templateStrict?: boolean;
    templateHintsByType?: Partial<Record<CharacterBlockType, { fieldHints?: Record<string, string> }>>;
    templateStrictOverride?: boolean | null; // Milestone 6 Step 8
    importedFrom?: { originalNoteId: string; exportedAt: number }; // Milestone 6 Step 9
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
    folderPath: string; 
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
    characterState?: CharacterState; // Legacy interim state
  };
  characterData?: CharacterData; // Milestone 6 new schema
  content: {
    format: 'tiptap';
    version: number; 
    doc: any; 
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
    folderId: string; 
    outboundLinks?: string[]; 
    // M6 Step 7: References for aggregation
    refs?: {
        places: string[];
        characters: string[];
    };
}

export interface IndexData {
    schemaVersion: number;
    updatedAt: number;
    notes: Record<string, IndexEntry>;
}

// Milestone 6 Step 9: Export Types
export interface CharacterBundleBase {
    bundleSchemaVersion: 1;
    exportedAt: number;
    sourceApp: { name: string, version?: string };
    character: {
        noteId: string;
        title: string;
        noteType: "character";
        status: NoteStatus;
        unresolved: boolean;
        universeTag: string | null;
        folderPath: string;
        createdAt: number;
        updatedAt: number;
    };
    template: {
        templateId: string;
        templateName?: string;
        strictMode?: boolean;
    };
    references: {
        places: Array<{ noteId: string, title?: string, unresolved?: boolean }>;
        characters: Array<{ noteId: string, title?: string, unresolved?: boolean }>;
        notes: Array<{ noteId: string, title?: string, unresolved?: boolean }>;
    };
}

export interface CharacterBundle extends CharacterBundleBase {
    selection: {
        formId: string;
        formName: string;
        snapshotId?: string | null;
    };
    resolvedSheet: {
        blocks: CharacterBlock[];
        normalized: {
            identity?: any;
            stats?: Record<string, number>;
            abilities?: any[];
            items?: any[];
            relationships?: any[];
            locations?: any;
            tags?: string[];
            narrativeSummary?: string;
        };
    };
}

export interface CharacterFullBundle extends CharacterBundleBase {
    characterData: CharacterData;
    selection: {
        currentFormId: string;
        currentSnapshotId?: string | null;
    };
}

// --- CONFIGURATION SCHEMAS ---

export interface ValidationRule {
    id: string;
    enabled: boolean;
    scope: string; 
    kind: "requiredField" | "warning" | "custom";
    data: any;
}

// Milestone 6 Step 8: Validation Settings
export interface CharacterValidationSettings {
    schemaVersion: 1;
    enabled: boolean;
    mode: "warnings" | "silent";
    defaultSeverity: "warning" | "error";
    statRanges: {
        enabled: boolean;
        defaults: { min: number; max: number };
        perStat?: Record<string, { min: number; max: number }>;
    };
    identityRules: {
        enabled: boolean;
        requiredFields: string[];
    };
    unresolvedPlaceLinks: {
        enabled: boolean;
    };
    conflictingPaths: {
        enabled: boolean;
        groups: Array<{ id: string; label: string; keys: string[] }>;
    };
}

export interface SettingsData {
    schemaVersion: number;
    updatedAt: number;
    ui: {
        theme: string;
        accentColor?: string; // Custom accent color
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
    characterValidation?: CharacterValidationSettings; // M6 Step 8
}

export interface ModuleDefinition {
    type: string;
    defaultData: any;
}

export interface NoteTemplate {
    templateId: string;
    name: string;
    kind: "blank" | "structured";
    contentBlocks: any[];
    defaultModules?: ModuleDefinition[];
    requiredModules?: string[];
    interviewQuestions?: InterviewQuestion[]; // Legacy M4
    suggestedModules?: string[];
    defaultOrder?: string[];
}

export interface AIInterviewTemplate {
    templateId: string;
    name: string;
    questions: InterviewQuestion[];
    outputPlan: any;
}

export interface NoteTypeDefinition {
    typeId: string; 
    name: string;
    defaultTemplateId: string;
    templates: NoteTemplate[];
    aiInterviewTemplates: AIInterviewTemplate[]; // Legacy? Merged into NoteTemplate for M6
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

// --- SEARCH TYPES ---
export interface SearchFilters {
    folderId: string | 'all';
    includeSubfolders: boolean;
    universeTagId: string | 'all' | 'none';
    type: string | 'all';
    status: string | 'all';
    unresolved: 'all' | 'unresolved' | 'resolved'; 
}

// --- PANE SYSTEM TYPES ---
export type PaneLayout = 'single' | 'splitVertical' | 'splitHorizontal' | 'quad';
export type PaneId = 'paneA' | 'paneB' | 'paneC' | 'paneD';

export type ViewType = 'note' | 'starmap' | 'glossary' | 'glossary_term' | 'pending_review' | 'missing' | 'search' | 'character';

export interface ViewRef {
  id: string; 
  kind: ViewType;
  title: string;
  icon?: string;
  version: number;
  lastActiveAt?: ISODate;
}

export interface NoteViewState {
  readMode: boolean;
  scrollY?: number;
}
export interface NoteTab extends ViewRef {
  kind: 'note';
  payload: {
    noteId: string;
  };
  state: NoteViewState;
}

export interface CharacterViewState {
    scrollY: number;
}
export interface CharacterTab extends ViewRef {
    kind: 'character';
    payload: {
        noteId: string;
    };
    state: CharacterViewState;
}

export interface StarMapViewState {
  zoom: number;
  panX: number;
  panY: number;
  selectedNodeId: string | null;
}
export interface StarMapTab extends ViewRef {
  kind: 'starmap';
  payload: {
    mapId: string | "main";
  };
  state: StarMapViewState;
}

export interface GlossaryViewState {
  search: string;
  selectedTermId: string | null;
  scrollY: number;
}
// Legacy Glossary Tab (Main View)
export interface GlossaryTab extends ViewRef {
  kind: 'glossary';
  payload: {
    scope: "all";
  };
  state: GlossaryViewState;
}

// Milestone 5: Glossary Entry Tab (Editing a specific term)
export interface GlossaryEntryTab extends ViewRef {
    kind: 'glossary_term';
    payload: {
        termId: string;
    };
    state: {
        scrollY: number;
    };
}

// Milestone 5 Step 2: Pending Review Tab
export interface PendingReviewTab extends ViewRef {
    kind: 'pending_review';
    payload: {
        pendingId: string;
    };
    state: {
        scrollY: number;
    };
}

export interface SearchResultsViewState {
    scrollY: number;
}
export interface SearchResultsTab extends ViewRef {
    kind: 'search';
    payload: {
        query: string;
        filters: SearchFilters;
    };
    state: SearchResultsViewState;
}

export interface MissingTab extends ViewRef {
  kind: 'missing';
  payload: {
    originalKind: string;
    originalId?: string;
    lastKnownTitle?: string;
  };
  state: any;
}

export type Tab = NoteTab | CharacterTab | StarMapTab | GlossaryTab | GlossaryEntryTab | PendingReviewTab | SearchResultsTab | MissingTab;

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
  paneOrder: PaneId[]; 
}

// --- UI PERSISTENCE TYPES ---

export type AppMode = 'notes' | 'starmap' | 'glossary';

export interface SidebarState {
    navWidth: number;
    navCollapsed: boolean;
    widgetWidth: number;
    widgetCollapsed: boolean;
}

export interface NotesNavigationState {
    selectedSection: string | null; 
    folderOpenState: Record<string, boolean>;
    searchState: {
        query: string;
        filters: SearchFilters;
        isFiltersOpen: boolean;
    };
}

export interface GlossaryNavigationState {
    searchQuery: string;
    selectedUniverses: string[];
    isPendingCollapsed: boolean;
    isTermsCollapsed: boolean;
}

export interface NavigationState {
    activeMode: AppMode;
    notes: NotesNavigationState;
    starmap?: any;
    glossary?: GlossaryNavigationState;
}

export interface WidgetSystemState {
    openWidgetIds: WidgetId[];
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
  pinnedNoteIds: ID[]; 
  
  // Persisted Configs
  settings: SettingsData;
  templates: TemplatesData;
  hotkeys: HotkeysData;
  maps: MapsData;

  // Legacy
  tags: Record<TagID, Tag>;
  
  // Milestone 5: Glossary Structure
  glossary: {
    terms: Record<GlossaryTermID, GlossaryTerm>; // In-memory cache of full terms
    pending: Record<ID, PendingTerm>;
    index: GlossaryIndex;
    occurrences: GlossaryOccurrences; // Milestone 5 Step 7
    ignoreList: string[]; // List of normalized keys to ignore for pending
  };
  
  // Milestone 6: Templates
  characterTemplates: Record<string, CharacterTemplate>;

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
  user_preferences: UserPreferences; 

  created_at: ISODate;
  updated_at: ISODate;
}

// Milestone 6: Character State (Legacy Support Type Alias)
export interface CharacterState {
    activeFormId: string;
    forms: CharacterForm[]; // Kept for type compat if needed, but CharacterData.forms is source of truth
    snapshots: CharacterSnapshot[];
}

export interface InterviewState {
    isActive: boolean;
    step: 'start' | 'questions' | 'review' | 'complete';
    currentQuestionIndex: number;
    answers: Record<string, string | string[]>; // questionId -> answer
    transcript: any[];
    generatedModules?: any[]; // Staged for review
}

export interface Note {
  id: ID;
  title: string; 
  type: string; 
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
  
  metadata?: {
      kind: 'general' | 'character' | string;
      data: any;
      characterState?: CharacterState; // Legacy Character state
      characterData?: CharacterData; // Milestone 6 Schema
      refs?: { places: string[]; characters: string[]; };
  }; 
  system?: any; 
  aiInterview?: InterviewState; // Milestone 6: Updated
  
  tag_ids: TagID[];
  content_plain?: string; 
  
  outbound_note_ids?: string[];
  
  // Transient flag to block save to disk (Milestone 6 Step 8)
  _preventSave?: boolean; 
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

// Milestone 5: Glossary Term
export interface GlossaryTerm {
  schemaVersion: number;
  termId: GlossaryTermID;
  primaryName: string;
  aliases: string[];
  definitionRichText: any; // TipTap JSON
  universeScopes: string[]; // Renamed from universeTags
  createdAt: number;
  updatedAt: number;
  canonical: true; // Must always be true for saved terms
  linksTo?: string[]; // Optional for now
}

// Milestone 5: Pending Term
export interface PendingTerm {
  schemaVersion: number;
  pendingId: ID;
  proposedName: string;
  detectedInNoteIds: string[];
  detectedSnippets: string[];
  reason: string; 
  createdAt: number;
}

// Milestone 5: Glossary Index
export interface GlossaryIndex {
    schemaVersion: number;
    updatedAt: number;
    lookup: Record<string, string>; // normalizedKey -> termId
    terms: Record<string, {
        primaryName: string;
        aliases: string[];
        universeScopes: string[];
        createdAt: number;
        updatedAt: number;
        canonical: true;
    }>;
    pending?: { count: number, ids: string[] };
}

// Milestone 5 Step 7: Occurrence Tracking
export interface GlossaryOccurrences {
  schemaVersion: number;
  updatedAt: number;
  terms: Record<string, { // termId
    noteIds: string[];
    snippetsByNote: Record<string, string[]>; // noteId -> snippets
    lastSeenAtByNote: Record<string, number>; // noteId -> timestamp
  }>;
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
