import type { Pit } from "./types";
import type { SideConfig } from "./sides";

/** A pit positioned on a side's combined grid. */
export interface PlacedPit extends Pit {
  gridRow: number;
  gridCol: number;
}

export interface WalkableGrid {
  rows: number;
  cols: number;
  /** walkable[r][c] = true if a pedestrian can stand on cell (r,c). */
  walkable: boolean[][];
  /** index of placed pits keyed by gridRow,gridCol. */
  byCell: Map<string, PlacedPit>;
}

export interface RouteStop {
  pit: PlacedPit;
  /** Walking path from the previous stop's doorway to this stop's doorway,
   *  including both endpoints. Empty for the first (home) stop. */
  pathFromPrev: Array<[number, number]>;
}

export interface RoutePlan {
  /** Stops in the order they should be visited, including home as first
   *  and (if returnHome) last entry. */
  stops: RouteStop[];
  /** Total walked grid cells across all path segments. */
  totalCells: number;
  /** Pits the user asked for that we couldn't reach (e.g. on the other side). */
  unreachable: PlacedPit[];
}

export function placePitsOnSide(side: SideConfig, pits: Pit[]): PlacedPit[] {
  return side.placements.flatMap((placement) =>
    pits
      .filter((p) => p.division === placement.id)
      .map((p) => ({
        ...p,
        gridRow: p.row + placement.rowOffset,
        gridCol: p.col + placement.colOffset,
      }))
  );
}

export function buildWalkableGrid(placed: PlacedPit[]): WalkableGrid {
  if (placed.length === 0) {
    return { rows: 0, cols: 0, walkable: [], byCell: new Map() };
  }
  const rows = Math.max(...placed.map((p) => p.gridRow)) + 1;
  const cols = Math.max(...placed.map((p) => p.gridCol)) + 1;
  const walkable: boolean[][] = Array.from({ length: rows }, () =>
    new Array<boolean>(cols).fill(true)
  );
  const byCell = new Map<string, PlacedPit>();
  for (const p of placed) {
    walkable[p.gridRow][p.gridCol] = false;
    byCell.set(`${p.gridRow},${p.gridCol}`, p);
  }
  return { rows, cols, walkable, byCell };
}

/** Cells immediately adjacent to a pit that a person could stand in (the
 *  pit's "doorways" onto the aisle). */
export function doorwaysOf(pit: PlacedPit, grid: WalkableGrid): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const candidates: Array<[number, number]> = [
    [pit.gridRow - 1, pit.gridCol],
    [pit.gridRow + 1, pit.gridCol],
    [pit.gridRow, pit.gridCol - 1],
    [pit.gridRow, pit.gridCol + 1],
  ];
  for (const [r, c] of candidates) {
    if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols && grid.walkable[r][c]) {
      out.push([r, c]);
    }
  }
  return out;
}

/** A* shortest path in 4-connected walkable grid. Returns inclusive path
 *  from start to end, or null if unreachable. */
export function aStar(
  start: [number, number],
  end: [number, number],
  grid: WalkableGrid
): Array<[number, number]> | null {
  const { rows, cols, walkable } = grid;
  if (!walkable[start[0]]?.[start[1]] || !walkable[end[0]]?.[end[1]]) return null;

  const heuristic = (r: number, c: number) =>
    Math.abs(r - end[0]) + Math.abs(c - end[1]);

  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const open = new Set<string>();
  const fScore = new Map<string, number>();

  const k = (r: number, c: number) => `${r},${c}`;
  const startKey = k(start[0], start[1]);
  open.add(startKey);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(start[0], start[1]));

  while (open.size > 0) {
    let current: string | null = null;
    let currentF = Infinity;
    for (const key of open) {
      const f = fScore.get(key) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = key;
      }
    }
    if (!current) break;

    const [cr, cc] = current.split(",").map(Number);
    if (cr === end[0] && cc === end[1]) {
      const path: Array<[number, number]> = [[cr, cc]];
      let cur = current;
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur)!;
        const [r, c] = cur.split(",").map(Number);
        path.unshift([r, c]);
      }
      return path;
    }

    open.delete(current);

    const neighbors: Array<[number, number]> = [
      [cr - 1, cc],
      [cr + 1, cc],
      [cr, cc - 1],
      [cr, cc + 1],
    ];
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (!walkable[nr][nc]) continue;
      const nKey = k(nr, nc);
      const tentative = (gScore.get(current) ?? Infinity) + 1;
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentative);
        fScore.set(nKey, tentative + heuristic(nr, nc));
        open.add(nKey);
      }
    }
  }
  return null;
}

/** Shortest A* path between any doorway of `from` and any doorway of `to`. */
function pathBetweenPits(
  from: PlacedPit,
  to: PlacedPit,
  grid: WalkableGrid
): { path: Array<[number, number]>; cost: number } | null {
  const fromDoors = doorwaysOf(from, grid);
  const toDoors = doorwaysOf(to, grid);
  let best: { path: Array<[number, number]>; cost: number } | null = null;
  for (const f of fromDoors) {
    for (const t of toDoors) {
      const p = aStar(f, t, grid);
      if (p && (!best || p.length < best.cost)) {
        best = { path: p, cost: p.length };
      }
    }
  }
  return best;
}

/** Greedy nearest-neighbor TSP. Start at home, visit each target by nearest
 *  remaining, optionally return to home at the end. */
export function planRoute(
  home: PlacedPit,
  visit: PlacedPit[],
  grid: WalkableGrid,
  options: { returnHome?: boolean } = {}
): RoutePlan {
  const stops: RouteStop[] = [{ pit: home, pathFromPrev: [] }];
  const remaining = [...visit];
  const unreachable: PlacedPit[] = [];
  let current = home;
  let totalCells = 0;

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestPath: Array<[number, number]> | null = null;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const r = pathBetweenPits(current, candidate, grid);
      if (r && r.cost < bestCost) {
        bestCost = r.cost;
        bestPath = r.path;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || !bestPath) {
      unreachable.push(...remaining);
      break;
    }
    const next = remaining[bestIdx];
    stops.push({ pit: next, pathFromPrev: bestPath });
    totalCells += bestCost;
    current = next;
    remaining.splice(bestIdx, 1);
  }

  if (options.returnHome && stops.length > 1) {
    const back = pathBetweenPits(current, home, grid);
    if (back) {
      stops.push({ pit: home, pathFromPrev: back.path });
      totalCells += back.cost;
    }
  }

  return { stops, totalCells, unreachable };
}

/** Convert a grid path (list of cells) to pixel coordinates given a per-row
 *  and per-col size table. Returns the centerpoint of each cell. */
export function pathToPixels(
  cells: Array<[number, number]>,
  rowSizes: number[],
  colSizes: number[],
  gap: number
): Array<{ x: number; y: number }> {
  const rowStart: number[] = [0];
  for (let i = 0; i < rowSizes.length; i++) {
    rowStart.push(rowStart[i] + rowSizes[i] + gap);
  }
  const colStart: number[] = [0];
  for (let i = 0; i < colSizes.length; i++) {
    colStart.push(colStart[i] + colSizes[i] + gap);
  }
  return cells.map(([r, c]) => ({
    x: colStart[c] + (colSizes[c] ?? 0) / 2,
    y: rowStart[r] + (rowSizes[r] ?? 0) / 2,
  }));
}
