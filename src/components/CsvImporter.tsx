"use client";

import { useState } from "react";
import { parseCsv, toCsv } from "@/lib/csv";
import type { Pit } from "@/lib/types";

interface Props {
  pits: Pit[];
  onLoad: (pits: Pit[]) => void;
  onReset: () => void;
  isOverridden: boolean;
}

export function CsvImporter({ pits, onLoad, onReset, isOverridden }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApply = () => {
    const result = parseCsv(text);
    if (result.errors.length > 0 && result.pits.length === 0) {
      setFeedback(result.errors.join(" · "));
      return;
    }
    onLoad(result.pits);
    setFeedback(
      `Loaded ${result.pits.length} pits` +
        (result.errors.length ? ` (${result.errors.length} warnings — check console)` : "")
    );
    if (result.errors.length) {
      console.warn("CSV warnings:", result.errors);
    }
  };

  const handleExport = () => {
    setText(toCsv(pits));
    setFeedback(`Exported ${pits.length} rows below — copy to clipboard or edit & re-apply.`);
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-neutral-300 hover:text-neutral-100"
      >
        <span className="flex items-center gap-2">
          <span className="text-neutral-500">⚙</span>
          Pit data {isOverridden ? "(custom)" : "(seed)"}
        </span>
        <span className="text-xs text-neutral-500">{open ? "hide" : "import / export"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-neutral-400">
            CSV header: <code className="text-amber-400">id,team,status,division,row,col</code>.
            Status one of TEAM/COL/INSP/EMT/AISLE. Division one of archimedes/curie/daly/galileo/hopper/johnson/milstein/newton.
            Saved to your browser only.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste CSV here…"
            className="w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 font-mono text-xs text-neutral-200"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleApply}
              className="text-xs px-3 py-1.5 rounded-md bg-amber-500 text-neutral-950 font-semibold hover:bg-amber-400"
            >
              Apply CSV
            </button>
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            >
              Export current
            </button>
            {isOverridden && (
              <button
                onClick={() => {
                  onReset();
                  setFeedback("Reset to bundled seed data.");
                }}
                className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 text-rose-300 hover:bg-rose-900/40"
              >
                Reset to seed
              </button>
            )}
          </div>
          {feedback && <p className="text-xs text-neutral-400">{feedback}</p>}
        </div>
      )}
    </div>
  );
}
