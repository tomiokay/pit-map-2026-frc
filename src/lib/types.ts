export type DivisionId =
  | "archimedes"
  | "curie"
  | "daly"
  | "galileo"
  | "hopper"
  | "johnson"
  | "milstein"
  | "newton";

export type PitStatus = "TEAM" | "COL" | "INSP" | "EMT" | "AISLE";

export interface Pit {
  id: string;
  team: number | null;
  status: PitStatus;
  division: DivisionId;
  row: number;
  col: number;
}

export interface DivisionMeta {
  id: DivisionId;
  name: string;
  drape: string;
  side: "left" | "right";
  swatch: string;
  ring: string;
}
