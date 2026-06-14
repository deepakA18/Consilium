"use client";

import { useEffect, useMemo, useState } from "react";
import { eventsToRoundVM, type LiveEvent } from "./live-round";
import type { RoundVM } from "./round-data";

const HUB = process.env.NEXT_PUBLIC_EVENTS_URL ?? "http://localhost:8787";

export type LiveStatus = "connecting" | "connected" | "offline";

/** Subscribes to the event hub's SSE stream and reduces it into a live RoundVM. */
export function useLiveRound(): { round: RoundVM | null; status: LiveStatus; running: boolean } {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<LiveStatus>("connecting");

  useEffect(() => {
    const es = new EventSource(`${HUB}/events`);
    es.onopen = () => setStatus("connected");
    es.onerror = () => setStatus("offline");
    es.onmessage = (m) => {
      let e: LiveEvent;
      try {
        e = JSON.parse(m.data) as LiveEvent;
      } catch {
        return;
      }
      // a fresh round:start resets the stream (the hub clears its log per round)
      setEvents((prev) => (e.kind === "round:start" ? [e] : [...prev, e]));
    };
    return () => es.close();
  }, []);

  const round = useMemo(() => eventsToRoundVM(events), [events]);
  const running = round != null && round.state === "live";
  return { round, status, running };
}

/** Trigger a real round on the hub. Returns false if one is already running / hub unreachable. */
export async function runLiveRound(): Promise<boolean> {
  try {
    const res = await fetch(`${HUB}/round/run`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
