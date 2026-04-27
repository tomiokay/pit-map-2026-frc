"use client";

export function LocationPanel() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
          <span aria-hidden>📡</span> Live location
          <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
            coming soon
          </span>
        </h3>
      </div>
      <p className="text-xs text-neutral-500 mt-1.5">
        Show your live position on the pit map. Needs a quick venue calibration
        step (tap 2–3 known pits while standing at them) before it can convert
        GPS readings into a “you are here” dot. Until that ships, use the
        search bar — it scrolls and centers any team’s pit on the map.
      </p>
    </div>
  );
}
