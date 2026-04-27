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
  onPitClick,
}: Props) {
  const dims = SIZE_PX[size];
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
  const stopIndexByPit = new Map<string, number>();
  routeStops.forEach((stop, idx) => {
    stopIndexByPit.set(`${stop.pit.division}-${stop.pit.id}`, idx);
  });
  const polylinePoints: Array<{ x: number; y: number }> = [];
  if (route) {
    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];
      const cellPx = pathToPixels(
        [[stop.pit.gridRow, stop.pit.gridCol]],
        rowSizes,
        colSizes,
        dims.gap
      )[0];
      if (i === 0) {
        polylinePoints.push(cellPx);
      } else {
        // Walk the path's interior cells (skip endpoints since they're
        // doorways, the visual "jump" from doorway → pit is handled below)
        const interior = stop.pathFromPrev.slice(0, -1);
        const interiorPx = pathToPixels(interior, rowSizes, colSizes, dims.gap);
        polylinePoints.push(...interiorPx, cellPx);
      }
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
        {polylinePoints.length > 1 && (
          <svg
            width={totalWidth}
            height={totalHeight}
            className="absolute inset-0 pointer-events-none z-10"
            viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          >
            <polyline
              points={polylinePoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="rgb(96 165 250)"
              strokeWidth={Math.max(2, dims.cell * 0.06)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.95"
              style={{ filter: "drop-shadow(0 0 4px rgba(96,165,250,0.6))" }}
            />
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
                    const stopIdx = stopIndexByPit.get(`${pit.division}-${pit.id}`);
                    if (stopIdx === undefined) return null;
                    const isHomeStop =
                      route &&
                      ((stopIdx === 0) ||
                        (stopIdx === route.stops.length - 1 &&
                          route.stops[0].pit.division === pit.division &&
                          route.stops[0].pit.id === pit.id));
                    return (
                      <span
                        className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 grid place-items-center rounded-full text-[9px] font-bold ring-2 ring-neutral-950 z-20 ${
                          isHomeStop
                            ? "bg-emerald-400 text-neutral-950"
                            : "bg-blue-400 text-neutral-950"
                        }`}
                        aria-hidden
                      >
                        {isHomeStop && stopIdx === 0
                          ? "S"
                          : isHomeStop
                          ? "E"
                          : stopIdx}
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
