import type { DivisionId } from "./types";
import { SEED_PITS } from "./pits";

export type SideId = "left" | "right";

export interface DivisionPlacement {
  id: DivisionId;
  rowOffset: number;
  colOffset: number;
}

export interface SideConfig {
  id: SideId;
  name: string;
  /** Long-form description shown under the title. */
  subtitle: string;
  placements: DivisionPlacement[];
}

/**
 * Spatial arrangement of divisions within the venue.
 * Left side of George R. Brown convention center → 4 divisions stacked 2×2.
 * Right side → 4 divisions stacked 2×2.
 *
 * Offsets are computed below from each division's natural row/col extents
 * so divisions sit edge-to-edge with a small aisle between them.
 */

// Conjoined: divisions on the same side share walls — no aisle row or
// column inserted between them. Each division still has its own internal
// aisle gaps from empty spreadsheet rows/cols.
const SIDE_GAP_COLS = 0;
const SIDE_GAP_ROWS = 0;

function maxCol(div: DivisionId): number {
  return Math.max(0, ...SEED_PITS.filter((p) => p.division === div).map((p) => p.col));
}

function maxRow(div: DivisionId): number {
  return Math.max(0, ...SEED_PITS.filter((p) => p.division === div).map((p) => p.row));
}

function buildSide(
  id: SideId,
  name: string,
  subtitle: string,
  layout: {
    tl: DivisionId;
    tr: DivisionId;
    bl: DivisionId;
    br: DivisionId;
    /** Manual row nudges so each bottom block lines up with its top neighbor.
     *  Negative = move up. Used because some divisions start with empty
     *  spreadsheet rows that look like a phantom gap. */
    blRowShift?: number;
    brRowShift?: number;
  }
): SideConfig {
  const tlCols = maxCol(layout.tl) + 1;
  const tlRows = maxRow(layout.tl) + 1;
  const trRows = maxRow(layout.tr) + 1;
  const blShift = layout.blRowShift ?? 0;
  const brShift = layout.brRowShift ?? 0;
  return {
    id,
    name,
    subtitle,
    placements: [
      { id: layout.tl, rowOffset: 0,                                   colOffset: 0 },
      { id: layout.tr, rowOffset: 0,                                   colOffset: tlCols + SIDE_GAP_COLS },
      { id: layout.bl, rowOffset: tlRows + SIDE_GAP_ROWS + blShift,    colOffset: 0 },
      { id: layout.br, rowOffset: trRows + SIDE_GAP_ROWS + brShift,    colOffset: tlCols + SIDE_GAP_COLS },
    ],
  };
}

export const SIDES: SideConfig[] = [
  buildSide("left", "Hall A", "Archimedes · Daly · Curie · Galileo", {
    tl: "archimedes",
    tr: "daly",
    bl: "curie",
    br: "galileo",
    blRowShift: -1, // Curie starts with an empty row in its data — shift up 1
    brRowShift: -2, // Galileo starts with two empty rows — shift up 2
  }),
  buildSide("right", "Hall E", "Hopper · Milstein · Johnson · Newton", {
    tl: "hopper",
    tr: "milstein",
    bl: "johnson",
    br: "newton",
    blRowShift: -2, // Johnson up 2
    brRowShift: -1, // Newton up 1
  }),
];

export const SIDE_BY_DIVISION: Record<DivisionId, SideConfig> = (() => {
  const out: Partial<Record<DivisionId, SideConfig>> = {};
  for (const side of SIDES) {
    for (const placement of side.placements) {
      out[placement.id] = side;
    }
  }
  return out as Record<DivisionId, SideConfig>;
})();

export function placementFor(side: SideConfig, division: DivisionId): DivisionPlacement | undefined {
  return side.placements.find((p) => p.id === division);
}
