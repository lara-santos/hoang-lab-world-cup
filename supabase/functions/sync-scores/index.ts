import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";

type IncomingMatch = {
  id?: string;
  matchNumber?: number;
  group?: string;
  stage?: string;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  home?: { name?: string };
  away?: { name?: string };
  kickoff?: string;
  date?: string;
  venue?: { name?: string };
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
};

function normalizeStatus(status?: string) {
  const value = status?.toLowerCase() ?? "";
  if (value.includes("finish") || value === "ft") return "finished";
  if (value.includes("live") || value.includes("progress")) return "live";
  return "scheduled";
}

function normalizeMatch(item: IncomingMatch) {
  const homeTeam = item.homeTeam?.name ?? item.home?.name ?? "TBD";
  const awayTeam = item.awayTeam?.name ?? item.away?.name ?? "TBD";
  const id = item.id ?? `match-${item.matchNumber ?? `${homeTeam}-${awayTeam}`}`.toLowerCase().replace(/\s+/g, "-");

  return {
    id,
    group_name: item.group ?? item.stage ?? "World Cup",
    home_team: homeTeam,
    away_team: awayTeam,
    kickoff: item.kickoff ?? item.date ?? new Date().toISOString(),
    venue: item.venue?.name ?? "TBD",
    status: normalizeStatus(item.status),
    home_score: item.homeScore ?? null,
    away_score: item.awayScore ?? null,
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async () => {
  const feedUrl = Deno.env.get("MATCH_FEED_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!feedUrl || !supabaseUrl || !serviceRoleKey) {
    return new Response("Missing MATCH_FEED_URL, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
  }

  const response = await fetch(feedUrl);
  if (!response.ok) {
    return new Response(`Feed request failed: ${response.status}`, { status: 502 });
  }

  const payload = await response.json();
  const rawMatches = Array.isArray(payload) ? payload : payload.matches ?? payload.Results ?? [];
  const matches = rawMatches.map(normalizeMatch);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.from("matches").upsert(matches, { onConflict: "id" });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return Response.json({ synced: matches.length });
});
