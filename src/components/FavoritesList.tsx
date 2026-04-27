"use client";

import type { Pit } from "@/lib/types";
import { DIVISION_BY_ID } from "@/lib/divisions";
import { colorForFavorite } from "@/lib/favoriteColors";
import { StarButton } from "./StarButton";

interface Props {
  favorites: number[];
  pitByTeam: Map<number, Pit>;
  onToggle: (team: number) => void;
  onJump: (pit: Pit) => void;
  onClear: () => void;
}

export function FavoritesList({ favorites, pitByTeam, onToggle, onJump, onClear }: Props) {
  if (favorites.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 p-5 text-center text-neutral-500 text-sm">
        Tap ★ on any team to pin it. Each favorite gets its own color on the map and is saved to this device.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest text-neutral-400">
          Favorites · {favorites.length}
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          Clear all
        </button>
      </div>
      <ul className="space-y-1.5">
        {favorites.map((team) => {
          const pit = pitByTeam.get(team);
          const color = colorForFavorite(team, favorites);
          if (!pit) {
            return (
              <li
                key={team}
                className="flex items-center gap-3 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                <span className="font-bold text-neutral-100 tabular-nums w-16">{team}</span>
                <span className="text-xs text-neutral-500 flex-1">not in dataset</span>
                <StarButton active onClick={() => onToggle(team)} size="sm" color={color} />
              </li>
            );
          }
          const div = DIVISION_BY_ID[pit.division];
          return (
            <li
              key={team}
              className="flex items-center gap-3 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 hover:border-neutral-600 cursor-pointer"
              onClick={() => onJump(pit)}
            >
              <span className={`w-3 h-3 rounded-full ${color.dot} ring-1 ring-white/10`} />
              <span className="font-bold text-neutral-100 tabular-nums w-16">{team}</span>
              <span className="text-neutral-300 font-semibold tabular-nums w-14">
                {pit.id}
              </span>
              <span className="text-xs text-neutral-500 truncate flex-1 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${div.swatch}`} />
                {div.name}
              </span>
              <StarButton active onClick={() => onToggle(team)} size="sm" color={color} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
