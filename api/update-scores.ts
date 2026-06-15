import { createClient } from "@supabase/supabase-js";

type FifaMatch = {
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
  home_score?: number;
  away_score?: number;
};

type VercelRequest = {
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeStatus(status?: string) {
  const value = status?.toLowerCase() ?? "";
  if (value.includes("finish") || value === "ft" || value === "completed") return "finished";
  if (value.includes("live") || value.includes("progress") || value.includes("half")) return "live";
  return "scheduled";
}

function fallbackId(match: FifaMatch) {
  const home = match.homeTeam?.name ?? match.home?.name ?? "home";
  const away = match.awayTeam?.name ?? match.away?.name ?? "away";
  return `match-${match.matchNumber ?? `${home}-${away}`}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function normalizeMatch(match: FifaMatch) {
  return {
    id: match.id ?? fallbackId(match),
    group_name: match.group ?? match.stage ?? "World Cup",
    home_team: match.homeTeam?.name ?? match.home?.name ?? "TBD",
    away_team: match.awayTeam?.name ?? match.away?.name ?? "TBD",
    kickoff: match.kickoff ?? match.date ?? new Date().toISOString(),
    venue: match.venue?.name ?? "TBD",
    status: normalizeStatus(match.status),
    home_score: match.homeScore ?? match.home_score ?? null,
    away_score: match.awayScore ?? match.away_score ?? null,
    updated_at: new Date().toISOString(),
  };
}

function authHeader(req: VercelRequest) {
  const raw = req.headers.authorization;
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader(req) !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const feedUrl = process.env.FIFA_MATCHES_URL;

  if (!supabaseUrl || !serviceRoleKey || !feedUrl) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or FIFA_MATCHES_URL",
    });
  }

  const response = await fetch(feedUrl);
  if (!response.ok) {
    return res.status(502).json({ error: `Score feed failed: ${response.status}` });
  }

  const payload = await response.json();
  const rawMatches = Array.isArray(payload) ? payload : payload.matches ?? payload.Results ?? payload.results ?? [];
  const matches = rawMatches.map(normalizeMatch).filter((match: ReturnType<typeof normalizeMatch>) => {
    return text(match.id) && text(match.home_team) && text(match.away_team);
  });

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.from("matches").upsert(matches, { onConflict: "id" });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ updated: matches.length });
}
