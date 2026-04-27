"use client";

interface Props {
  value: string;
  onChange: (next: string) => void;
  matchCount: number;
}

export function SearchBar({ value, onChange, matchCount }: Props) {
  return (
    <div className="sticky top-0 z-30 px-4 sm:px-6 py-3 bg-neutral-950 border-b border-neutral-800 shadow-md shadow-neutral-950/60">
      <div className="relative max-w-3xl mx-auto">
        <input
          type="search"
          inputMode="numeric"
          autoFocus
          placeholder="Search team number…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl bg-neutral-900 border border-neutral-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40 outline-none pl-5 pr-28 py-4 text-2xl font-semibold tracking-wide text-neutral-50 placeholder:text-neutral-500"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {value && (
            <span className="text-xs text-neutral-400 tabular-nums">
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </span>
          )}
          {value && (
            <button
              onClick={() => onChange("")}
              className="text-xs px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
