"use client";

import { useEffect, useState } from "react";

export type GeoStatus =
  | "idle"
  | "requesting"
  | "tracking"
  | "denied"
  | "unavailable"
  | "error";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GeoState {
  status: GeoStatus;
  position: GeoPosition | null;
  error: string | null;
}

/** Live GPS tracking via the browser's Geolocation API.
 *  Active when `enabled` is true; clears the watch on unmount or disable. */
export function useGeoLocation(enabled: boolean): GeoState {
  const [state, setState] = useState<GeoState>({
    status: "idle",
    position: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, status: "idle" }));
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({
        status: "unavailable",
        position: null,
        error: "Geolocation API not supported in this browser.",
      });
      return;
    }

    setState((s) => ({ ...s, status: "requesting", error: null }));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: "tracking",
          position: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
          },
          error: null,
        });
      },
      (err) => {
        const status: GeoStatus =
          err.code === err.PERMISSION_DENIED ? "denied" : "error";
        setState((s) => ({
          ...s,
          status,
          error: err.message || "Location lookup failed.",
        }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return state;
}

/** Great-circle distance between two coordinates in meters (Haversine). */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Initial bearing from a → b in degrees clockwise from north. */
export function bearingDegrees(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const CALIBRATIONS_KEY = "pit-map-geo-calibrations-v1";

export interface CalibrationPoint {
  pitId: string;
  division: string;
  latitude: number;
  longitude: number;
  recordedAt: number;
}

export function loadCalibrations(): CalibrationPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CALIBRATIONS_KEY);
    return raw ? (JSON.parse(raw) as CalibrationPoint[]) : [];
  } catch {
    return [];
  }
}

export function saveCalibrations(points: CalibrationPoint[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CALIBRATIONS_KEY, JSON.stringify(points));
}
