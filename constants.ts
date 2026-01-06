import { NoteStatus, NoteType } from "./types";

export const DEFAULT_SETTINGS = {
  showOutdatedInMap: false,
  version: "1.0",
};

export const INITIAL_NOTE_CONTENT = "Start writing your canon...";

export const STATUS_COLORS: Record<NoteStatus, string> = {
  "Canon": "text-emerald-400 border-emerald-400",
  "Outdated": "text-slate-500 border-slate-500",
  "Experimental": "text-amber-400 border-amber-400",
  "Draft": "text-zinc-400 border-zinc-400",
  "Archived": "text-zinc-600 border-zinc-600"
};

export const TYPE_ICONS: Record<NoteType, string> = {
  "General": "📄",
  "Character": "👤",
  "Place": "🪐",
  "Item": "📦",
  "Event": "📅",
  "Lore": "📜"
};