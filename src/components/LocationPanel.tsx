"use client";

import { useState } from "react";
import { useGeoLocation } from "@/lib/geo";

interface Props {
  /** Optional callback used by the calibration flow. */
  onCalibrateRequest?: () => void;
}

export function LocationPanel({ onCalibrateRequest }: Props) {
  const [enabled, setEnabled] = useState(false);
  const geo = useGeoLocation(enabled);

  const accuracyTone = (() => {
    if (!geo.position) return "text-neutral-400";
    if (geo.position.accuracy <= 15) return "text-emerald-400";
    if (geo.position.accuracy <= 40) return "text-amber-400";
    return "text-rose-400";
  })();

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
          <span aria-hidden>📡</span> My GPS location
        </h3>
        <button
          onClick={() => setEnabled((e) => !e)}
          className={`text-xs px-3 py-1.5 rounded-md font-semibold transition ${
            enabled
              ? "bg-rose-500 text-neutral-950 hover:bg-rose-400"
              : "bg-amber-500 text-neutral-950 hover:bg-amber-400"
          }`}
        >
          {enabled ? "Stop tracking" : "Start tracking"}
        </button>
      </div>

      {!enabled && (
        <p className="text-xs text-neutral-500">
          Tap to start GPS. Your phone will ask permission once. Heads up: indoor
          GPS at convention centers is usually <strong>±20–100m</strong>, so the
          coords below are best used outdoors or near doors. For pit-level
          accuracy, use the on-map search instead.
        </p>
      )}

      {enabled && geo.status === "requesting" && (
        <p className="text-xs text-neutral-400">Waiting for first GPS fix…</p>
      )}

      {enabled && geo.status === "denied" && (
        <p className="text-xs text-rose-300">
          Location permission was denied. Open your browser settings → Site
          permissions → Location to allow this site.
        </p>
      )}

      {enabled && geo.status === "unavailable" && (
        <p className="text-xs text-rose-300">
          Geolocation isn’t available in this browser.
        </p>
      )}

      {enabled && geo.status === "error" && (
        <p className="text-xs text-rose-300">
          Couldn’t get a fix: {geo.error}
        </p>
      )}

      {enabled && geo.position && (
        <div className="space-y-1 text-xs font-mono mt-2">
          <Row label="Latitude" value={geo.position.latitude.toFixed(6) + "°"} />
          <Row label="Longitude" value={geo.position.longitude.toFixed(6) + "°"} />
          <Row
            label="Accuracy"
            value={
              <span className={accuracyTone}>
                ±{geo.position.accuracy.toFixed(0)} m{" "}
                {geo.position.accuracy > 40 && (
                  <span className="opacity-80">(likely indoors)</span>
                )}
              </span>
            }
          />
          {geo.position.heading != null && !Number.isNaN(geo.position.heading) && (
            <Row label="Heading" value={geo.position.heading.toFixed(0) + "°"} />
          )}
          {geo.position.speed != null && (
            <Row
              label="Speed"
              value={(geo.position.speed * 3.6).toFixed(1) + " km/h"}
            />
          )}
          <Row
            label="Updated"
            value={new Date(geo.position.timestamp).toLocaleTimeString()}
          />
          <div className="pt-2 flex gap-2 flex-wrap">
            <a
              className="text-[11px] px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
              href={`https://maps.google.com/?q=${geo.position.latitude},${geo.position.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
            {onCalibrateRequest && (
              <button
                onClick={onCalibrateRequest}
                className="text-[11px] px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
              >
                Tag this fix to a pit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-neutral-500 w-20">{label}</span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}
