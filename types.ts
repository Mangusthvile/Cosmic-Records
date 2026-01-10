export type ID = string; // uuid
export type ISODate = string; // legacy support if needed, but moving to number for Note
export type Timestamp = number; // Date.now()

// Updated Note Status per Milestone 4
export type NoteStatus = "Draft" | "Canon" | "Experimental" | "Outdated" | "Archived";

// Milestone 7: Consolidated Note Types (Strictly 4)
export type NoteType = "general" | "modular" | "place" | "canvas"; 

// RecordKind distinguishes subtypes of Modular notes (and potentially Place/Canvas flavors)
export type RecordKind = "character" | "place" | "item" | "event" | "lore" | "custom";

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

// Milestone 7: Modular System

export type PrimitiveModuleType = 
    | "richText" 
    | "fields" 
    | "table" 
    | "list" 
    | "links" 
    | "tags" 
    | "images"
    | "custom";

export interface ModuleInstance {
    moduleId: string;
    type: PrimitiveModuleType;
    title: string;
    collapsed: boolean;
    presetId: string | null;
    payload: any;
}

export interface ModuleLayoutItem {
    moduleId: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

// -- Module Payloads --

export interface RichTextPayload {
    doc: any; // TipTap doc JSON
}

export interface FieldsPayload {
    fields: Array<{ id?: string; key: string; value: string }>;
}

export interface TablePayload {
    columns: string[];
    rows: any[];
}

export interface ListPayload {
    items: string[];
}

export interface LinksPayload {
    links: Array<{ targetNoteId: string; label?: string; relation?: string }>;
}

export interface TagsPayload {
    tags: string[];
}

export interface ImagesPayload {
    images: Array<{ src: string; caption?: string }>;
}

// Character Specific Payloads (Legacy/Migration support)
export interface IdentityPayload {
    fields: Array<{ key: string; value: string }>;
}
export interface StatsPayload {
    stats: Array<{ name: string; value: number }>;
}
export interface AbilityItem {
    name: string;
    type?: string;
    descriptionDoc?: any;
    tags?: string[];
}
export interface AbilitiesPayload {
    abilities: AbilityItem[];
}
export interface InventoryItem {
    name: string;
    qty: number;
    notes?: string;
    isEquipped?: boolean;
    description?: string;
}
export interface ItemsPayload {
    items: InventoryItem[];
}
export interface RelationshipItem {
    relId?: string;
    targetCharacterId: string;
    type: string;
    notesDoc?: any;
    notes?: string;
    nameFallback?: string;
}
export interface RelationshipsPayload {
    schemaVersion: number;
    relationships: RelationshipItem[];
}
export interface ReferencePayload {
    [key: string]: any;
}
export interface LocationItem {
    id?: string;
    placeId: string;
    label?: string;
}
export interface LocationsPayload {
    schemaVersion: number;
    originPlaceId: string | null;
    currentPlaceId: string | null;
    otherPlaces: LocationItem[];
    travelNotes?: string;
    originPlace?: { nameFallback?: string };
    currentPlace?: { nameFallback?: string };
}

// Place Specific Data
export interface PlaceData {
    parentPlaceId: string | null;
    placeKind?: string;
    coordinates?: { x: number, y: number };
}

export interface Eras {
    order: string[];
    byId: Record<string, { 
        id: string; 
        title: string; 
        start?: string; 
        end?: string; 
        summary?: string;
    }>;
}

// Legacy Character Block Type
export type CharacterBlockType = 
    | 'identity' | 'summary' | 'appearance' | 'personality' | 'stats' 
    | 'abilities' | 'items' | 'relationships' | 'history' | 'locations' 
    | 'tags' | 'authorNotes' | 'unknown' | 'text' | 'keyValue' | 'statGrid' | 'meter';

export interface CharacterBlock {
    blockId: string;
    type: CharacterBlockType;
    title: string;
    collapsed: boolean;
    payload: any;
}

// --- TEMPLATES ---
export type MappingRuleType = 'setField' | 'appendList' | 'richTextFrom';

export interface InterviewMappingRule {
    type: MappingRuleType;
    moduleType: string;
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
    targetHint?: { moduleType?: string; field?: string };
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
    name: string;
    description?: string;
    strictMode: boolean;
    
    recordKind: RecordKind; // Added M7 for mapping template to recordKind

    modules?: Array<{
        type: PrimitiveModuleType;
        presetId?: string;
        title?: string;
        defaultPayload?: any;
    }>;

    // Legacy M6 fields kept for compat/migration
    kind?: string; 
    requiredModules?: CharacterBlockType[];
    suggestedModules?: CharacterBlockType[];
    defaultOrder?: CharacterBlockType[];
    moduleDefaults?: any;
    
    validationHooks?: {
        onSave?: Array<{ id: string; message: string; level: 'warn' | 'error' }>;
    };
    interview?: InterviewDefinition;
    validation?: any;
}

export interface TemplatesIndex {
    schemaVersion: number;
    updatedAt: number;
    templates: Array<{
        templateId: string;
        kind: string;
        name: string;
        description?: string;
        file: string;
    }>;
}

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
    overrides: Record<string, ModuleOverride>;
    localBlocks: CharacterBlock[]; 
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
        blocks: CharacterBlock[]; 
    };
}

export interface CharacterData {
    templateId: string;
    blocks: CharacterBlock[]; 
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
    templateStrict?: boolean;
    templateHintsByType?: any;
    templateStrictOverride?: boolean | null;
    importedFrom?: { originalNoteId: string; exportedAt: number };
}

export interface DiskNote {
  schemaVersion: number; 
  noteId: string;
  meta: {
    title: string;
    type: string;
    recordKind?: RecordKind;
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
    characterState?: CharacterState;
  };
  modules?: ModuleInstance[];
  layout?: ModuleLayoutItem[];
  templateId?: string;
  placeData?: PlaceData;
  eras?: Eras;
  characterData?: CharacterData; 
  content: {
    format: 'tiptap';
    version: number; 
    doc: any; 
  };
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

export interface CharacterBundleBase {
    bundleSchemaVersion: 1;
    exportedAt: number;
    sourceApp: { name: string, version?: string };
    character: {
        noteId: string;
        title: string;
        noteType: string;
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
        blocks: any[];
        normalized: any;
    };
}

export interface CharacterFullBundle extends CharacterBundleBase {
    characterData: CharacterData;
    selection: {
        currentFormId: string;
        currentSnapshotId?: string | null;
    };
}

export interface ValidationRule {
    id: string;
    enabled: boolean;
    scope: string; 
    kind: "requiredField" | "warning" | "custom";
    data: any;
}

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
        accentColor?: string; 
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
    characterValidation?: CharacterValidationSettings; 
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
    interviewQuestions?: InterviewQuestion[]; 
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
    typeId: string; // Should match NoteType: "general" | "modular" | "place" | "canvas"
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

export interface SearchFilters {
    folderId: string | 'all';
    includeSubfolders: boolean;
    universeTagId: string | 'all' | 'none';
    type: string | 'all';
    status: string | 'all';
    unresolved: 'all' | 'unresolved' | 'resolved'; 
}

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
export interface GlossaryTab extends ViewRef {
  kind: 'glossary';
  payload: {
    scope: "all";
  };
  state: GlossaryViewState;
}

export interface GlossaryEntryTab extends ViewRef {
    kind: 'glossary_term';
    payload: {
        termId: string;
    };
    state: {
        scrollY: number;
    };
}

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

export interface Workspace {
  schema_version: "1.0";
  workspace_id: ID;
  name: string;

  notes: Record<ID, Note>;
  folders: Record<ID, Folder>;
  pinnedNoteIds: ID[]; 
  
  settings: SettingsData;
  templates: TemplatesData;
  hotkeys: HotkeysData;
  maps: MapsData;

  tags: Record<TagID, Tag>;
  
  glossary: {
    terms: Record<GlossaryTermID, GlossaryTerm>; 
    pending: Record<ID, PendingTerm>;
    index: GlossaryIndex;
    occurrences: GlossaryOccurrences; 
    ignoreList: string[]; 
  };
  
  characterTemplates: Record<string, CharacterTemplate>;

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

export interface CharacterState {
    activeFormId: string;
    forms: CharacterForm[];
    snapshots: CharacterSnapshot[];
}

export interface InterviewState {
    isActive: boolean;
    step: 'start' | 'questions' | 'review' | 'complete';
    currentQuestionIndex: number;
    answers: Record<string, string | string[]>; 
    transcript: any[];
    generatedModules?: any[]; 
}

export interface Note {
  id: ID;
  title: string; 
  type: NoteType; 
  recordKind?: RecordKind;
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
  
  modules?: ModuleInstance[];
  layout?: ModuleLayoutItem[];
  templateId?: string;
  placeData?: PlaceData;
  eras?: Eras;

  metadata?: {
      kind: 'general' | 'character' | string;
      data: any;
      characterState?: CharacterState; // Legacy Character state
      characterData?: CharacterData; // Legacy Character Data
      refs?: { places: string[]; characters: string[]; };
  }; 
  system?: any; 
  aiInterview?: InterviewState; 
  
  tag_ids: TagID[];
  content_plain?: string; 
  
  outbound_note_ids?: string[];
  
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

export interface GlossaryTerm {
  schemaVersion: number;
  termId: GlossaryTermID;
  primaryName: string;
  aliases: string[];
  definitionRichText: any; 
  universeScopes: string[]; 
  createdAt: number;
  updatedAt: number;
  canonical: true; 
  linksTo?: string[]; 
}

export interface PendingTerm {
  schemaVersion: number;
  pendingId: ID;
  proposedName: string;
  detectedInNoteIds: string[];
  detectedSnippets: string[];
  reason: string; 
  createdAt: number;
}

export interface GlossaryIndex {
    schemaVersion: number;
    updatedAt: number;
    lookup: Record<string, string>; 
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

export interface GlossaryOccurrences {
  schemaVersion: number;
  updatedAt: number;
  terms: Record<string, { 
    noteIds: string[];
    snippetsByNote: Record<string, string[]>; 
    lastSeenAtByNote: Record<string, number>; 
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

export interface MigrationAction {
    kind: "convertNoteType" | "renameFile" | "moveFile" | "resolveConflict" | "updateIndex" | "writeBackup";
    noteId?: string;
    oldType?: string;
    newType?: string;
    oldPath?: string;
    newPath?: string;
    fromPath?: string;
    toPath?: string;
    changesSummary?: string;
    reason?: string;
    backupPath?: string;
}

export interface MigrationPlan {
    createdAt: string;
    vaultRootId: string;
    actions: MigrationAction[];
}