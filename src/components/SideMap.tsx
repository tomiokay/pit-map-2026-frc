"use client";

import type { Pit } from "@/lib/types";
import { DIVISION_BY_ID } from "@/lib/divisions";
import { colorForFavorite } from "@/lib/favoriteColors";
import type { SideConfig } from "@/lib/sides";
import { pathToPixels, type RoutePlan } from "@/lib/router";
import type { MapSize } from "@/lib/store";

interface PlacedPit extends Pit {
  gridRow: number;
  gridCol: number;
}

interface Props {
  side: SideConfig;
  pits: Pit[];
  highlightedTeam: number | null;
  favorites: number[];
  size?: MapSize;
  myTeam?: number | null;
  route?: RoutePlan | null;
  activeLeg?: number | null;
  doneTeams?: number[];
  onPitClick?: (pit: Pit) => void;
}

const SIZE_PX: Record<MapSize, { cell: number; aisleCol: number; aisleRow: number; gap: number; idText: string; teamText: string; showId: boolean }> = {
  XS: { cell: 24, aisleCol: 8,  aisleRow: 6,  gap: 1, idText: "hidden",     teamText: "text-[8px]",  showId: false },
  S:  { cell: 36, aisleCol: 14, aisleRow: 10, gap: 1, idText: "text-[8px]",  teamText: "text-[10px]", showId: true },
  M:  { cell: 60, aisleCol: 28, aisleRow: 16, gap: 3, idText: "text-[10px]", teamText: "text-[13px] sm:text-sm", showId: true },
  L:  { cell: 78, aisleCol: 36, aisleRow: 22, gap: 4, idText: "text-[11px]", teamText: "text-base", showId: true },
};

export function SideMap({
  side,
  pits,
  highlightedTeam,
  favorites,
  size = "M",
  myTeam,
  route,
  activeLeg,
  doneTeams,
  onPitClick,
}: Props) {
  const dims = SIZE_PX[size];
  const doneSet = new Set(doneTeams ?? []);
  const placed: PlacedPit[] = side.placements.flatMap((placement) => {
    return pits
      .filter((p) => p.division === placement.id)
      .map((p) => ({
        ...p,
        gridRow: p.row + placement.rowOffset,
        gridCol: p.col + placement.colOffset,
      }));
  });

  if (placed.length === 0) {
    return (
      <div className="text-sm text-neutral-500 italic">No pits loaded for this side.</div>
    );
  }

  const maxGridRow = Math.max(...placed.map((p) => p.gridRow));
  const maxGridCol = Math.max(...placed.map((p) => p.gridCol));

  const cells = new Map<string, PlacedPit>();
  for (const p of placed) cells.set(`${p.gridRow},${p.gridCol}`, p);

  const populatedRows = new Set(placed.map((p) => p.gridRow));
  const populatedCols = new Set(placed.map((p) => p.gridCol));

  const rowsArr = Array.from({ length: maxGridRow + 1 }, (_, r) => r);
  const colsArr = Array.from({ length: maxGridCol + 1 }, (_, c) => c);

  const colSizes = colsArr.map((c) =>
    populatedCols.has(c) ? dims.cell : dims.aisleCol
  );
  const rowSizes = rowsArr.map((r) =>
    populatedRows.has(r) ? dims.cell : dims.aisleRow
  );
  const colTemplate = colSizes.map((s) => `${s}px`).join(" ");
  const rowTemplate = rowSizes.map((s) => `${s}px`).join(" ");

  const totalWidth = colSizes.reduce((a, b) => a + b, 0) + dims.gap * (colSizes.length - 1);
  const totalHeight = rowSizes.reduce((a, b) => a + b, 0) + dims.gap * (rowSizes.length - 1);

  const favSet = new Set(favorites);

  // Pre-compute pixel positions for all stops in the route + the polyline.
  const routeStops = route?.stops ?? [];
  // First occurrence wins, so the home pit gets index 0 ("S") even when the
  // route loops back through it as the final stop.
  const stopIndexByPit = new Map<string, number>();
  // Track whether a pit also appears as the final stop (return-home case).
  const isReturnStop = new Map<string, boolean>();
  routeStops.forEach((stop, idx) => {
    const key = `${stop.pit.division}-${stop.pit.id}`;
    if (!stopIndexByPit.has(key)) stopIndexByPit.set(key, idx);
    if (idx === routeStops.length - 1 && idx > 0) isReturnStop.set(key, true);
  });
  // Build one polyline per "leg" between consecutive stops, each tinted a
  // different colour so overlapping segments stay readable.
  type Leg = { id: string; points: string; stroke: string; legIndex: number };
  const legs: Leg[] = [];
  if (route && route.stops.length > 1) {
    const legPalette = [
      "rgb(96 165 250)",   // sky-400
      "rgb(167 139 250)",  // violet-400
      "rgb(244 114 182)",  // pink-400
      "rgb(251 146 60)",   // orange-400
      "rgb(250 204 21)",   // yellow-400
      "rgb(74 222 128)",   // green-400
      "rgb(45 212 191)",   // teal-400
      "rgb(192 132 252)",  // purple-400
    ];
    for (let i = 1; i < route.stops.length; i++) {
      const prevStop = route.stops[i - 1];
      const stop = route.stops[i];
      const prevCenter = pathToPixels(
        [[prevStop.pit.gridRow, prevStop.pit.gridCol]],
        rowSizes,
        colSizes,
        dims.gap
      )[0];
      const stopCenter = pathToPixels(
        [[stop.pit.gridRow, stop.pit.gridCol]],
        rowSizes,
        colSizes,
        dims.gap
      )[0];
      const innerPx = pathToPixels(stop.pathFromPrev, rowSizes, colSizes, dims.gap);
      const points = [prevCenter, ...innerPx, stopCenter]
        .map((p) => `${p.x},${p.y}`)
        .join(" ");
      legs.push({
        id: `leg-${i}`,
        legIndex: i - 1,
        points,
        stroke: legPalette[(i - 1) % legPalette.length],
      });
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
      <header className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-neutral-100 text-lg">{side.name}</h3>
          <p className="text-xs text-neutral-500">{side.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {side.placements.map((placement) => {
            const div = DIVISION_BY_ID[placement.id];
            return (
              <span
                key={placement.id}
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-400"
              >
                <span className={`w-2 h-2 rounded-full ${div.swatch}`} />
                {div.name}
              </span>
            );
          })}
        </div>
      </header>

      <div className="w-full overflow-x-auto">
        <div className="relative mx-auto w-max">
        {legs.length > 0 && (
          <svg
            width={totalWidth}
            height={totalHeight}
            className="absolute inset-0 pointer-events-none z-10"
            viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          >
            <defs>
              {legs.map((leg) => (
                <marker
                  key={`arrow-${leg.id}`}
                  id={`arrow-${side.id}-${leg.id}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={leg.stroke} />
                </marker>
              ))}
            </defs>
            {legs.map((leg) => (
              <polyline
                key={leg.id}
                points={leg.points}
                fill="none"
                stroke={leg.stroke}
                strokeWidth={Math.max(2.5, dims.cell * 0.08)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={
                  activeLeg == null
                    ? 0.85
                    : activeLeg === leg.legIndex
                    ? 1
                    : 0.15
                }
                markerEnd={`url(#arrow-${side.id}-${leg.id})`}
                style={{
                  mixBlendMode: "screen",
                  filter:
                    activeLeg == null || activeLeg === leg.legIndex
                      ? `drop-shadow(0 0 3px ${leg.stroke})`
                      : "none",
                }}
              />
            ))}
          </svg>
        )}
        <div
          className="grid select-none"
          style={{
            gridTemplateColumns: colTemplate,
            gridTemplateRows: rowTemplate,
            gap: `${dims.gap}px`,
          }}
        >
          {rowsArr.map((r) =>
            colsArr.map((c) => {
              const pit = cells.get(`${r},${c}`);
              if (!pit) return <div key={`${r}-${c}`} />;

              const div = DIVISION_BY_ID[pit.division];
              const isHighlight = pit.team !== null && pit.team === highlightedTeam;
              const isFav = pit.team !== null && favSet.has(pit.team);
              const isSpecial = pit.status !== "TEAM";

              const baseColor = isSpecial
                ? "bg-neutral-800/60 border-neutral-700 text-neutral-500"
                : "bg-neutral-900 border-neutral-700 text-neutral-100";

              let highlightClass = "";
              if (isHighlight) {
                highlightClass =
                  "ring-2 ring-white bg-white/15 border-white text-white animate-pulse";
              } else if (isFav && pit.team !== null) {
                highlightClass = colorForFavorite(pit.team, favorites).cell;
              }

              return (
                <button
                  key={`${pit.division}-${pit.id}`}
                  onClick={() => onPitClick?.(pit)}
                  data-team={pit.team ?? undefined}
                  data-pit={pit.id}
                  className={`relative rounded-md border flex flex-col items-center justify-center px-1 text-center transition ${baseColor} ${highlightClass}`}
                  title={
                    pit.team
                      ? `Team ${pit.team} – Pit ${pit.id} (${div.name})`
                      : `${pit.id} – ${pit.status} (${div.name})`
                  }
                >
                  {dims.showId && (
                    <div className={`font-mono leading-none text-neutral-500 ${dims.idText}`}>
                      {pit.id}
                    </div>
                  )}
                  <div className={`font-bold tabular-nums leading-tight ${dims.showId ? "mt-0.5" : ""} ${dims.teamText}`}>
                    {pit.status === "TEAM" ? pit.team : pit.status}
                  </div>
                  <span
                    className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full ${div.swatch} ring-1 ring-neutral-950/40`}
                    aria-hidden
                  />
                  {isFav && pit.team !== null && (
                    <span
                      className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full ${colorForFavorite(pit.team, favorites).dot} ring-1 ring-neutral-950`}
                      aria-hidden
                    />
                  )}
                  {pit.team !== null && pit.team === myTeam && (
                    <span
                      className="absolute -top-1.5 -left-1.5 w-4 h-4 grid place-items-center rounded-full bg-emerald-400 text-neutral-950 text-[8px] font-black ring-1 ring-neutral-950"
                      aria-label="My team"
                      title="My team"
                    >
                      ME
                    </span>
                  )}
                  {(() => {
                    const key = `${pit.division}-${pit.id}`;
                    const stopIdx = stopIndexByPit.get(key);
                    if (stopIdx === undefined) return null;
                    const isStart = stopIdx === 0;
                    const isReturn = isReturnStop.get(key) === true;
                    const label = isStart
                      ? isReturn
                        ? "S/E"
                        : "S"
                      : String(stopIdx);
                    return (
                      <span
                        className={`absolute -bottom-1.5 -right-1.5 ${
                          label === "S/E" ? "px-1 w-auto" : "w-4"
                        } h-4 grid place-items-center rounded-full text-[9px] font-bold ring-2 ring-neutral-950 z-20 ${
                          isStart
                            ? "bg-emerald-400 text-neutral-950"
                            : "bg-blue-400 text-neutral-950"
                        }`}
                        aria-hidden
                      >
                        {label}
                      </span>
                    );
                  })()}
                </button>
              );
            })
          )}
        </div>
        </div>
      </div>
    </section>
  );
}
