"use client";

import { useCallback, useEffect, useState } from "react";
import type { DivisionId, Pit } from "./types";
import { SEED_PITS } from "./pits";

const FAVORITES_KEY = "pit-map-favorites-v1";
const PITS_OVERRIDE_KEY = "pit-map-pits-override-v1";
const MY_PIT_KEY = "pit-map-my-pit-v1";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function usePits(): {
  pits: Pit[];
  setPits: (pits: Pit[]) => void;
  resetPits: () => void;
  isOverridden: boolean;
} {
  const [pits, setPitsState] = useState<Pit[]>(SEED_PITS);
  const [isOverridden, setIsOverridden] = useState(false);

  useEffect(() => {
    const stored = readJSON<Pit[] | null>(PITS_OVERRIDE_KEY, null);
    if (stored && Array.isArray(stored) && stored.length > 0) {
      setPitsState(stored);
      setIsOverridden(true);
    }
  }, []);

  const setPits = useCallback((next: Pit[]) => {
    setPitsState(next);
    setIsOverridden(true);
    writeJSON(PITS_OVERRIDE_KEY, next);
  }, []);

  const resetPits = useCallback(() => {
    setPitsState(SEED_PITS);
    setIsOverridden(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PITS_OVERRIDE_KEY);
    }
  }, []);

  return { pits, setPits, resetPits, isOverridden };
}

export function useFavorites(): {
  favorites: number[];
  isFavorite: (team: number) => boolean;
  toggle: (team: number) => void;
  clear: () => void;
} {
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    setFavorites(readJSON<number[]>(FAVORITES_KEY, []));
  }, []);

  const persist = useCallback((next: number[]) => {
    setFavorites(next);
    writeJSON(FAVORITES_KEY, next);
  }, []);

  const isFavorite = useCallback(
    (team: number) => favorites.includes(team),
    [favorites]
  );

  const toggle = useCallback(
    (team: number) => {
      const next = favorites.includes(team)
        ? favorites.filter((t) => t !== team)
        : [...favorites, team];
      persist(next);
    },
    [favorites, persist]
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { favorites, isFavorite, toggle, clear };
}

export interface MyPit {
  pitId: string;
  division: DivisionId;
  team: number | null;
}

export function useMyPit(): {
  myPit: MyPit | null;
  setMyPit: (p: MyPit | null) => void;
} {
  const [myPit, setMyPitState] = useState<MyPit | null>(null);

  useEffect(() => {
    setMyPitState(readJSON<MyPit | null>(MY_PIT_KEY, null));
  }, []);

  const setMyPit = useCallback((p: MyPit | null) => {
    setMyPitState(p);
    if (p) {
      writeJSON(MY_PIT_KEY, p);
    } else if (typeof window !== "undefined") {
      window.localStorage.removeItem(MY_PIT_KEY);
    }
  }, []);

  return { myPit, setMyPit };
}
