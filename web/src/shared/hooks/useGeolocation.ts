import { useCallback, useEffect, useState } from "react";

export type GeoStatus = "idle" | "asking" | "granted" | "denied" | "unavailable";

export interface Coords {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy: number;
}

const SESSION_KEY = "kcc.coords";

function readCached(): Coords | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "lat" in parsed &&
      "lng" in parsed &&
      typeof (parsed as Coords).lat === "number" &&
      typeof (parsed as Coords).lng === "number"
    ) {
      return parsed as Coords;
    }
  } catch {
    // Corrupt or unavailable storage — behave as if there were no cache.
  }
  return null;
}

/**
 * Geolocation with session persistence, so a seeker who grants permission once
 * does not get re-prompted on every navigation.
 */
export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(readCached);
  const [status, setStatus] = useState<GeoStatus>(() => (readCached() ? "granted" : "idle"));

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: Coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setCoords(next);
        setStatus("granted");
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
        } catch {
          // Non-fatal: we simply re-ask next session.
        }
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 120_000 },
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus("idle");
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore.
    }
  }, []);

  return { coords, status, request, clear };
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
