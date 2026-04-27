"use client";

const ITEMS = [
  { tag: "INSP", desc: "Inspection station — robots get tech-inspected here" },
  { tag: "COL",  desc: "Building column / pillar that took the place of a pit" },
  { tag: "EMT",  desc: "EMT / first-aid station" },
  { tag: "AISLE", desc: "Walkway, no pit" },
];

export function Legend() {
  return (
    <details className="rounded-xl border border-neutral-800 bg-neutral-900/40">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-neutral-300 hover:text-neutral-100 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-neutral-500">ⓘ</span>
          Legend — what do INSP, COL, EMT mean?
        </span>
        <span className="text-xs text-neutral-500">tap to {`open / close`}</span>
      </summary>
      <ul className="px-4 pb-4 space-y-2">
        {ITEMS.map((item) => (
          <li key={item.tag} className="flex items-start gap-3 text-sm">
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400 font-mono text-xs min-w-[3.25rem] text-center">
              {item.tag}
            </span>
            <span className="text-neutral-300">{item.desc}</span>
          </li>
        ))}
        <li className="pt-2 border-t border-neutral-800 text-xs text-neutral-500">
          Greyed-out cells in the map are these non-team slots.
        </li>
      </ul>
    </details>
  );
}
