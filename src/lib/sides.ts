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

// Conjoined: divisions on the same side share walls — no aisle column or
// row inserted between them. Each division still has its own internal
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
  layout: { tl: DivisionId; tr: DivisionId; bl: DivisionId; br: DivisionId }
): SideConfig {
  const tlCols = maxCol(layout.tl) + 1;
  const tlRows = maxRow(layout.tl) + 1;
  const trRows = maxRow(layout.tr) + 1;
  const blCols = maxCol(layout.bl) + 1;
  const leftSlotCols = Math.max(tlCols, blCols);
  const topSlotRows = Math.max(tlRows, trRows);

  return {
    id,
    name,
    subtitle,
    placements: [
      { id: layout.tl, rowOffset: 0, colOffset: 0 },
      { id: layout.tr, rowOffset: 0, colOffset: leftSlotCols + SIDE_GAP_COLS },
      { id: layout.bl, rowOffset: topSlotRows + SIDE_GAP_ROWS, colOffset: 0 },
      { id: layout.br, rowOffset: topSlotRows + SIDE_GAP_ROWS, colOffset: leftSlotCols + SIDE_GAP_COLS },
    ],
  };
}

export const SIDES: SideConfig[] = [
  buildSide("left", "West Hall", "Archimedes · Daly · Curie · Galileo", {
    tl: "archimedes",
    tr: "daly",
    bl: "curie",
    br: "galileo",
  }),
  buildSide("right", "East Hall", "Hopper · Milstein · Johnson · Newton", {
    tl: "hopper",
    tr: "milstein",
    bl: "johnson",
    br: "newton",
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
