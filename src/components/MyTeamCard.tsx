"use client";

import { useState } from "react";
import type { Pit } from "@/lib/types";
import { DIVISION_BY_ID } from "@/lib/divisions";

interface Props {
  myTeam: number | null;
  myPit: Pit | null;
  onSet: (team: number | null) => void;
  onJump: (pit: Pit) => void;
}

export function MyTeamCard({ myTeam, myPit, onSet, onJump }: Props) {
  const [editing, setEditing] = useState(myTeam == null);
  const [draft, setDraft] = useState(myTeam ? String(myTeam) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const n = Number(draft.trim());
    if (!draft.trim() || !Number.isFinite(n) || n <= 0) {
      setError("Enter a valid team number.");
      return;
    }
    setError(null);
    onSet(n);
    setEditing(false);
  };

  if (myTeam == null && !editing) {
    return null;
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-4">
        <h3 className="text-sm font-bold text-emerald-200 mb-1 flex items-center gap-2">
          <span aria-hidden>👋</span> Set your team
        </h3>
        <p className="text-xs text-neutral-400 mb-3">
          We’ll mark your pit on the map and use it as the start/end of any
          route you plan. You can change this anytime.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. 254"
            className="flex-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-base font-bold tabular-nums text-neutral-100"
            autoFocus
          />
          <button
            onClick={submit}
            className="text-sm px-4 py-2 rounded-md bg-emerald-400 text-neutral-950 font-semibold hover:bg-emerald-300"
          >
            Save
          </button>
          {myTeam != null && (
            <button
              onClick={() => {
                setEditing(false);
                setDraft(String(myTeam));
                setError(null);
              }}
              className="text-sm px-3 py-2 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            >
              Cancel
            </button>
          )}
        </div>
        {error && <p className="text-xs text-rose-300 mt-2">{error}</p>}
      </div>
    );
  }

  // Compact display once team is set.
  const div = myPit ? DIVISION_BY_ID[myPit.division] : null;
  return (
    <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/15 px-4 py-2.5 flex items-center gap-3">
      <span className="w-7 h-7 grid place-items-center rounded-full bg-emerald-400 text-neutral-950 text-[10px] font-black">
        ME
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-widest text-emerald-300/80">
          My team
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-black tabular-nums text-emerald-200 text-lg">
            {myTeam}
          </span>
          {myPit && div ? (
            <button
              onClick={() => onJump(myPit)}
              className="text-xs text-neutral-300 hover:text-neutral-100"
            >
              Pit <span className="font-mono">{myPit.id}</span> ·{" "}
              <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle ${div.swatch}`} />{" "}
              {div.name}
            </button>
          ) : (
            <span className="text-xs text-rose-300">not in dataset</span>
          )}
        </div>
      </div>
      <button
        onClick={() => {
          setEditing(true);
          setDraft(String(myTeam));
        }}
        className="text-xs text-neutral-400 hover:text-neutral-100 px-2 py-1 rounded-md hover:bg-neutral-800"
      >
        Change
      </button>
    </div>
  );
}
