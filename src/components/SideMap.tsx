"use client";

import type { Pit } from "@/lib/types";
import { DIVISION_BY_ID } from "@/lib/divisions";
import { colorForFavorite } from "@/lib/favoriteColors";
import type { SideConfig } from "@/lib/sides";

interface PlacedPit extends Pit {
  gridRow: number;
  gridCol: number;
}

interface Props {
  side: SideConfig;
  pits: Pit[];
  highlightedTeam: number | null;
  favorites: number[];
  onPitClick?: (pit: Pit) => void;
}

export function SideMap({ side, pits, highlightedTeam, favorites, onPitClick }: Props) {
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

  const colTemplate = colsArr
    .map((c) => (populatedCols.has(c) ? "60px" : "20px"))
    .join(" ");
  const rowTemplate = rowsArr
    .map((r) => (populatedRows.has(r) ? "60px" : "16px"))
    .join(" ");

  const favSet = new Set(favorites);

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
        <div
          className="grid gap-[3px] select-none mx-auto w-max"
          style={{
            gridTemplateColumns: colTemplate,
            gridTemplateRows: rowTemplate,
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
                  className={`relative rounded-md border flex flex-col items-center justify-center px-1 text-center transition ${baseColor} ${highlightClass}`}
                  title={
                    pit.team
                      ? `Team ${pit.team} – Pit ${pit.id} (${div.name})`
                      : `${pit.id} – ${pit.status} (${div.name})`
                  }
                >
                  <div className="font-mono text-[10px] leading-none text-neutral-500">
                    {pit.id}
                  </div>
                  <div className="font-bold tabular-nums text-[13px] sm:text-sm leading-tight mt-0.5">
                    {pit.status === "TEAM" ? pit.team : pit.status}
                  </div>
                  <span
                    className={`absolute top-0 left-0.5 w-1 h-1 rounded-full ${div.swatch} opacity-70`}
                    aria-hidden
                  />
                  {isFav && pit.team !== null && (
                    <span
                      className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full ${colorForFavorite(pit.team, favorites).dot} ring-1 ring-neutral-950`}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
