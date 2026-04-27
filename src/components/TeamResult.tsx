"use client";

import type { Pit } from "@/lib/types";
import { DIVISION_BY_ID } from "@/lib/divisions";
import { colorForFavorite } from "@/lib/favoriteColors";
import { StarButton } from "./StarButton";

interface Props {
  pit: Pit;
  isFavorite: boolean;
  favorites: number[];
  onToggleFavorite: () => void;
  onJumpToMap: () => void;
}

export function TeamResult({ pit, isFavorite, favorites, onToggleFavorite, onJumpToMap }: Props) {
  const div = DIVISION_BY_ID[pit.division];
  const color = pit.team !== null ? colorForFavorite(pit.team, favorites) : undefined;
  return (
    <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-block w-3 h-3 rounded-full ring-1 ring-white/10 ${div.swatch}`} />
            <span className="text-xs uppercase tracking-widest text-neutral-400">
              {div.name} Division · {div.drape} drape
            </span>
            {isFavorite && color && (
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${color.dot} ring-1 ring-white/10`} />
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-4xl sm:text-5xl font-black text-amber-400 tabular-nums">
              {pit.team ?? "—"}
            </h2>
            <span className="text-neutral-500">→</span>
            <div className="text-2xl sm:text-3xl font-bold text-neutral-100 tabular-nums">
              Pit {pit.id}
            </div>
          </div>
        </div>
        <StarButton
          active={isFavorite}
          onClick={onToggleFavorite}
          size="lg"
          color={isFavorite ? color : undefined}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onJumpToMap}
          className="text-sm px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-950 font-semibold hover:bg-amber-400"
        >
          Show on map
        </button>
      </div>
    </div>
  );
}
