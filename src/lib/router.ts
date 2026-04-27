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

const samePit = (a: PlacedPit, b: PlacedPit) =>
  a.division === b.division && a.id === b.id;

/** Plan a walking route. Uses exact Held-Karp DP for ≤12 stops (truly
 *  optimal) and falls back to greedy nearest-neighbour for larger trips. */
export function planRoute(
  home: PlacedPit,
  visit: PlacedPit[],
  grid: WalkableGrid,
  options: { returnHome?: boolean; endAt?: PlacedPit } = {}
): RoutePlan {
  const internal = options.endAt
    ? visit.filter((v) => !samePit(v, options.endAt!))
    : visit;
  if (internal.length <= 12) {
    return planRouteHeldKarp(home, internal, grid, options);
  }
  return planRouteGreedy(home, internal, grid, options);
}

function planRouteGreedy(
  home: PlacedPit,
  visit: PlacedPit[],
  grid: WalkableGrid,
  options: { returnHome?: boolean; endAt?: PlacedPit } = {}
): RoutePlan {
  const stops: RouteStop[] = [{ pit: home, pathFromPrev: [] }];
  const endAt = options.endAt;
  const remaining = [...visit];
  const unreachable: PlacedPit[] = [];
  let current = home;
  let totalCells = 0;

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestPath: Array<[number, number]> | null = null;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const r = pathBetweenPits(current, remaining[i], grid);
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
    stops.push({ pit: remaining[bestIdx], pathFromPrev: bestPath });
    totalCells += bestCost;
    current = remaining[bestIdx];
    remaining.splice(bestIdx, 1);
  }

  if (endAt && !samePit(current, endAt)) {
    const finalLeg = pathBetweenPits(current, endAt, grid);
    if (finalLeg) {
      stops.push({ pit: endAt, pathFromPrev: finalLeg.path });
      totalCells += finalLeg.cost;
      current = endAt;
    }
  }

  if (options.returnHome && stops.length > 1 && !samePit(current, home)) {
    const back = pathBetweenPits(current, home, grid);
    if (back) {
      stops.push({ pit: home, pathFromPrev: back.path });
      totalCells += back.cost;
    }
  }

  return { stops, totalCells, unreachable };
}

/** Exact Held-Karp DP for path TSP. Pre-computes pairwise A* costs once,
 *  then finds the optimal order in O(N²·2^N) time. Practical for N ≤ ~12. */
function planRouteHeldKarp(
  home: PlacedPit,
  internal: PlacedPit[],
  grid: WalkableGrid,
  options: { returnHome?: boolean; endAt?: PlacedPit } = {}
): RoutePlan {
  const endAt = options.endAt;
  const N = internal.length;

  // Pits indexed in cost matrix: 0 = home, 1..N = internal, N+1 = endAt
  // (endAt is added if specified). Compute pairwise A* paths once.
  const pits: PlacedPit[] = [home, ...internal];
  if (endAt) pits.push(endAt);
  type Edge = { cost: number; path: Array<[number, number]> } | null;
  const cost: Edge[][] = pits.map((from, i) =>
    pits.map((to, j) => (i === j ? { cost: 0, path: [] } : pathBetweenPits(from, to, grid)))
  );

  const unreachable: PlacedPit[] = [];
  for (let i = 1; i <= N; i++) if (cost[0][i] === null) unreachable.push(internal[i - 1]);
  if (endAt && cost.every((row) => row[pits.length - 1] === null)) unreachable.push(endAt);

  // Trivial case: no internal visits
  if (N === 0) {
    const stops: RouteStop[] = [{ pit: home, pathFromPrev: [] }];
    let totalCells = 0;
    if (endAt && cost[0][pits.length - 1]) {
      const e = cost[0][pits.length - 1]!;
      stops.push({ pit: endAt, pathFromPrev: e.path });
      totalCells += e.cost;
      if (options.returnHome) {
        const r = pathBetweenPits(endAt, home, grid);
        if (r) {
          stops.push({ pit: home, pathFromPrev: r.path });
          totalCells += r.cost;
        }
      }
    }
    return { stops, totalCells, unreachable };
  }

  // Held-Karp DP. mask is a bitset over internal visits (bit i = visit i+1
  // is included). dp[mask][v] is the cheapest path from home that visits
  // exactly the set in mask and ends at internal visit v (1..N).
  const INF = Infinity;
  const FULL = (1 << N) - 1;
  const dp: number[][] = Array.from({ length: 1 << N }, () => new Array(N + 1).fill(INF));
  const par: number[][] = Array.from({ length: 1 << N }, () => new Array(N + 1).fill(-1));

  for (let i = 0; i < N; i++) {
    if (cost[0][i + 1]) dp[1 << i][i + 1] = cost[0][i + 1]!.cost;
  }

  for (let mask = 1; mask <= FULL; mask++) {
    for (let v = 1; v <= N; v++) {
      const vBit = 1 << (v - 1);
      if (!(mask & vBit)) continue;
      if (dp[mask][v] === INF) continue;
      for (let u = 1; u <= N; u++) {
        const uBit = 1 << (u - 1);
        if (mask & uBit) continue;
        const c = cost[v][u];
        if (!c) continue;
        const newMask = mask | uBit;
        const newCost = dp[mask][v] + c.cost;
        if (newCost < dp[newMask][u]) {
          dp[newMask][u] = newCost;
          par[newMask][u] = v;
        }
      }
    }
  }

  // Score every possible ending and pick the best, accounting for endAt
  // and returnHome tails.
  const endAtIdx = endAt ? pits.length - 1 : -1;
  let bestEnd = -1;
  let bestTotal = INF;
  for (let v = 1; v <= N; v++) {
    if (dp[FULL][v] === INF) continue;
    let total = dp[FULL][v];
    if (endAt) {
      const tail = cost[v][endAtIdx];
      if (!tail) continue;
      total += tail.cost;
    }
    if (options.returnHome) {
      const finalIdx = endAt ? endAtIdx : v;
      const back = cost[finalIdx][0];
      if (!back) continue;
      total += back.cost;
    }
    if (total < bestTotal) {
      bestTotal = total;
      bestEnd = v;
    }
  }

  // No reachable ordering — fall back to whatever greedy can salvage.
  if (bestEnd < 0) return planRouteGreedy(home, internal, grid, options);

  // Reconstruct the order of internal visits.
  const order: number[] = [];
  let cur = bestEnd;
  let mask = FULL;
  while (cur >= 1) {
    order.unshift(cur);
    const prev = par[mask][cur];
    mask ^= 1 << (cur - 1);
    if (prev < 1) break;
    cur = prev;
  }

  const stops: RouteStop[] = [{ pit: home, pathFromPrev: [] }];
  let totalCells = 0;
  let prevIdx = 0;
  for (const v of order) {
    const c = cost[prevIdx][v]!;
    stops.push({ pit: pits[v], pathFromPrev: c.path });
    totalCells += c.cost;
    prevIdx = v;
  }

  if (endAt) {
    const c = cost[prevIdx][endAtIdx];
    if (c) {
      stops.push({ pit: endAt, pathFromPrev: c.path });
      totalCells += c.cost;
      prevIdx = endAtIdx;
    }
  }

  if (options.returnHome && !samePit(pits[prevIdx], home)) {
    const c = cost[prevIdx][0];
    if (c) {
      stops.push({ pit: home, pathFromPrev: c.path });
      totalCells += c.cost;
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
