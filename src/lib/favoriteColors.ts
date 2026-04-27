/**
 * Distinct colors for favorited teams. Each team is deterministically
 * assigned a palette slot based on its position in the favorites list,
 * so the colors stay stable as long as the user doesn't reorder.
 */

export interface FavoriteColor {
  name: string;
  /** Tailwind classes for cells highlighted as a favorite (border + bg + ring + text). */
  cell: string;
  /** Color dot for use in lists, legends, etc. */
  dot: string;
  /** Star button background (uses bg-COLOR text-OPACITY). */
  star: string;
}

// Pre-defined classes so Tailwind 4 picks them up at build time.
export const FAVORITE_PALETTE: FavoriteColor[] = [
  {
    name: "amber",
    cell: "ring-2 ring-amber-400 bg-amber-400/15 border-amber-400 text-amber-100",
    dot:  "bg-amber-400",
    star: "bg-amber-400 text-neutral-950 hover:bg-amber-300",
  },
  {
    name: "emerald",
    cell: "ring-2 ring-emerald-400 bg-emerald-400/15 border-emerald-400 text-emerald-100",
    dot:  "bg-emerald-400",
    star: "bg-emerald-400 text-neutral-950 hover:bg-emerald-300",
  },
  {
    name: "sky",
    cell: "ring-2 ring-sky-400 bg-sky-400/15 border-sky-400 text-sky-100",
    dot:  "bg-sky-400",
    star: "bg-sky-400 text-neutral-950 hover:bg-sky-300",
  },
  {
    name: "fuchsia",
    cell: "ring-2 ring-fuchsia-400 bg-fuchsia-400/15 border-fuchsia-400 text-fuchsia-100",
    dot:  "bg-fuchsia-400",
    star: "bg-fuchsia-400 text-neutral-950 hover:bg-fuchsia-300",
  },
  {
    name: "orange",
    cell: "ring-2 ring-orange-400 bg-orange-400/15 border-orange-400 text-orange-100",
    dot:  "bg-orange-400",
    star: "bg-orange-400 text-neutral-950 hover:bg-orange-300",
  },
  {
    name: "lime",
    cell: "ring-2 ring-lime-400 bg-lime-400/15 border-lime-400 text-lime-100",
    dot:  "bg-lime-400",
    star: "bg-lime-400 text-neutral-950 hover:bg-lime-300",
  },
  {
    name: "violet",
    cell: "ring-2 ring-violet-400 bg-violet-400/15 border-violet-400 text-violet-100",
    dot:  "bg-violet-400",
    star: "bg-violet-400 text-neutral-950 hover:bg-violet-300",
  },
  {
    name: "rose",
    cell: "ring-2 ring-rose-400 bg-rose-400/15 border-rose-400 text-rose-100",
    dot:  "bg-rose-400",
    star: "bg-rose-400 text-neutral-950 hover:bg-rose-300",
  },
  {
    name: "cyan",
    cell: "ring-2 ring-cyan-400 bg-cyan-400/15 border-cyan-400 text-cyan-100",
    dot:  "bg-cyan-400",
    star: "bg-cyan-400 text-neutral-950 hover:bg-cyan-300",
  },
  {
    name: "pink",
    cell: "ring-2 ring-pink-400 bg-pink-400/15 border-pink-400 text-pink-100",
    dot:  "bg-pink-400",
    star: "bg-pink-400 text-neutral-950 hover:bg-pink-300",
  },
];

export function colorForFavorite(team: number, favorites: number[]): FavoriteColor {
  const idx = favorites.indexOf(team);
  if (idx < 0) return FAVORITE_PALETTE[0];
  return FAVORITE_PALETTE[idx % FAVORITE_PALETTE.length];
}
