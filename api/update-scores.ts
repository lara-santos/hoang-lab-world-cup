import { createClient } from "@supabase/supabase-js";

type FifaMatch = {
  id?: string;
  IdMatch?: string;
  matchNumber?: number;
  MatchNumber?: number;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  home?: { name?: string };
  away?: { name?: string };
  Home?: { TeamName?: Array<{ Description?: string }>; ShortClubName?: string; Abbreviation?: string; Score?: number };
  Away?: { TeamName?: Array<{ Description?: string }>; ShortClubName?: string; Abbreviation?: string; Score?: number };
  date?: string;
  Date?: string;
  kickoff?: string;
  stage?: string;
  group?: string;
  StageName?: Array<{ Description?: string }>;
  GroupName?: Array<{ Description?: string }>;
  venue?: { name?: string };
  Stadium?: { Name?: Array<{ Description?: string }> };
  status?: string;
  MatchStatus?: number;
  ResultType?: number;
  homeScore?: number;
  awayScore?: number;
  home_score?: number;
  away_score?: number;
  HomeTeamScore?: number | null;
  AwayTeamScore?: number | null;
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

function localizedName(values?: Array<{ Description?: string }>) {
  return values?.[0]?.Description;
}

function normalizeStatus(status?: string, matchStatus?: number, resultType?: number) {
  if (resultType === 1 || matchStatus === 0) return "finished";
  if (matchStatus === 3 || matchStatus === 12) return "live";
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
  const homeName = match.homeTeam?.name ?? match.home?.name ?? localizedName(match.Home?.TeamName) ?? match.Home?.ShortClubName;
  const awayName = match.awayTeam?.name ?? match.away?.name ?? localizedName(match.Away?.TeamName) ?? match.Away?.ShortClubName;

  return {
    id: match.id ?? match.IdMatch ?? fallbackId(match),
    group_name: match.group ?? localizedName(match.GroupName) ?? match.stage ?? localizedName(match.StageName) ?? "World Cup",
    home_team: homeName ?? "TBD",
    away_team: awayName ?? "TBD",
    kickoff: match.kickoff ?? match.date ?? match.Date ?? new Date().toISOString(),
    venue: match.venue?.name ?? localizedName(match.Stadium?.Name) ?? "TBD",
    status: normalizeStatus(match.status, match.MatchStatus, match.ResultType),
    home_score: match.homeScore ?? match.home_score ?? match.HomeTeamScore ?? match.Home?.Score ?? null,
    away_score: match.awayScore ?? match.away_score ?? match.AwayTeamScore ?? match.Away?.Score ?? null,
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
