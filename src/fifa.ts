import { seedMatches } from "./data";
import type { Match } from "./domain";

type FifaLikeMatch = {
  id?: string;
  matchNumber?: number;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  home?: { name?: string };
  away?: { name?: string };
  date?: string;
  kickoff?: string;
  stage?: string;
  group?: string;
  venue?: { name?: string };
  status?: string;
  homeScore?: number;
  awayScore?: number;
};

function normalizeStatus(status?: string): Match["status"] {
  const value = status?.toLowerCase() ?? "";
  if (value.includes("finish") || value === "ft") return "finished";
  if (value.includes("live") || value.includes("progress")) return "live";
  return "scheduled";
}

export function normalizeFifaMatch(item: FifaLikeMatch): Match {
  const homeTeam = item.homeTeam?.name ?? item.home?.name ?? "TBD";
  const awayTeam = item.awayTeam?.name ?? item.away?.name ?? "TBD";

  return {
    id: item.id ?? `match-${item.matchNumber ?? `${homeTeam}-${awayTeam}`}`.toLowerCase().replace(/\s+/g, "-"),
    group: item.group ?? item.stage ?? "World Cup",
    homeTeam,
    awayTeam,
    kickoff: item.kickoff ?? item.date ?? new Date().toISOString(),
    venue: item.venue?.name ?? "TBD",
    status: normalizeStatus(item.status),
    homeScore: item.homeScore,
    awayScore: item.awayScore,
  };
}

export async function syncMatches(): Promise<Match[]> {
  const configuredUrl = import.meta.env.VITE_FIFA_MATCHES_URL as string | undefined;

  if (!configuredUrl) {
    return seedMatches;
  }

  const response = await fetch(configuredUrl);
  if (!response.ok) {
    throw new Error(`Could not sync matches: ${response.status}`);
  }

  const payload = await response.json();
  const matches = Array.isArray(payload) ? payload : payload.matches ?? payload.Results ?? [];
  return matches.map(normalizeFifaMatch);
}
