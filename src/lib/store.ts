"use client";

import { useCallback, useEffect, useState } from "react";
import type { DivisionId, Pit } from "./types";
import { SEED_PITS } from "./pits";

const FAVORITES_KEY = "pit-map-favorites-v1";
const PITS_OVERRIDE_KEY = "pit-map-pits-override-v1";
const MY_PIT_KEY = "pit-map-my-pit-v1";
const MAP_SIZE_KEY = "pit-map-size-v1";
const MY_TEAM_KEY = "pit-map-my-team-v1";
const SAVED_ROUTES_KEY = "pit-map-saved-routes-v1";

export type MapSize = "XS" | "S" | "M" | "L";

export function useMapSize(): {
  size: MapSize;
  setSize: (s: MapSize) => void;
} {
  const [size, setSizeState] = useState<MapSize>("M");
  useEffect(() => {
    const stored = readJSON<MapSize | null>(MAP_SIZE_KEY, null);
    if (stored && ["XS", "S", "M", "L"].includes(stored)) setSizeState(stored);
  }, []);
  const setSize = useCallback((s: MapSize) => {
    setSizeState(s);
    writeJSON(MAP_SIZE_KEY, s);
  }, []);
  return { size, setSize };
}

export function useMyTeam(): {
  myTeam: number | null;
  setMyTeam: (team: number | null) => void;
} {
  const [myTeam, setMyTeamState] = useState<number | null>(null);

  useEffect(() => {
    const stored = readJSON<number | null>(MY_TEAM_KEY, null);
    if (typeof stored === "number" && Number.isFinite(stored)) {
      setMyTeamState(stored);
    }
  }, []);

  const setMyTeam = useCallback((team: number | null) => {
    setMyTeamState(team);
    if (team === null) {
      if (typeof window !== "undefined") window.localStorage.removeItem(MY_TEAM_KEY);
    } else {
      writeJSON(MY_TEAM_KEY, team);
    }
  }, []);

  return { myTeam, setMyTeam };
}

export interface SavedRoute {
  id: string;
  name: string;
  teams: number[];
  returnHome: boolean;
  createdAt: number;
}

export function useSavedRoutes(): {
  savedRoutes: SavedRoute[];
  saveRoute: (name: string, teams: number[], returnHome: boolean) => SavedRoute;
  deleteRoute: (id: string) => void;
  renameRoute: (id: string, name: string) => void;
} {
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);

  useEffect(() => {
    setSavedRoutes(readJSON<SavedRoute[]>(SAVED_ROUTES_KEY, []));
  }, []);

  const persist = useCallback((next: SavedRoute[]) => {
    setSavedRoutes(next);
    writeJSON(SAVED_ROUTES_KEY, next);
  }, []);

  const saveRoute = useCallback(
    (name: string, teams: number[], returnHome: boolean): SavedRoute => {
      const route: SavedRoute = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim() || `Route of ${teams.length}`,
        teams: [...teams],
        returnHome,
        createdAt: Date.now(),
      };
      // Read latest from localStorage in case other tabs wrote since mount.
      const current = readJSON<SavedRoute[]>(SAVED_ROUTES_KEY, []);
      persist([route, ...current]);
      return route;
    },
    [persist]
  );

  const deleteRoute = useCallback(
    (id: string) => {
      persist(savedRoutes.filter((r) => r.id !== id));
    },
    [persist, savedRoutes]
  );

  const renameRoute = useCallback(
    (id: string, name: string) => {
      persist(
        savedRoutes.map((r) =>
          r.id === id ? { ...r, name: name.trim() || r.name } : r
        )
      );
    },
    [persist, savedRoutes]
  );

  return { savedRoutes, saveRoute, deleteRoute, renameRoute };
}

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
