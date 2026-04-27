import type { DivisionMeta } from "./types";

export const DIVISIONS: DivisionMeta[] = [
  { id: "archimedes", name: "Archimedes", drape: "Red",      side: "left",  swatch: "bg-red-600",     ring: "ring-red-500" },
  { id: "curie",      name: "Curie",      drape: "Black",    side: "left",  swatch: "bg-neutral-900", ring: "ring-neutral-700" },
  { id: "daly",       name: "Daly",       drape: "Grey",     side: "left",  swatch: "bg-slate-500",   ring: "ring-slate-400" },
  { id: "galileo",    name: "Galileo",    drape: "Green",    side: "left",  swatch: "bg-emerald-600", ring: "ring-emerald-500" },
  { id: "hopper",     name: "Hopper",     drape: "Blue",     side: "right", swatch: "bg-blue-600",    ring: "ring-blue-500" },
  { id: "johnson",    name: "Johnson",    drape: "Gold",     side: "right", swatch: "bg-amber-500",   ring: "ring-amber-400" },
  { id: "milstein",   name: "Milstein",   drape: "Burgundy", side: "right", swatch: "bg-rose-800",    ring: "ring-rose-700" },
  { id: "newton",     name: "Newton",     drape: "White",    side: "right", swatch: "bg-zinc-200",    ring: "ring-zinc-300" },
];

export const DIVISION_BY_ID: Record<string, DivisionMeta> = Object.fromEntries(
  DIVISIONS.map((d) => [d.id, d])
);
