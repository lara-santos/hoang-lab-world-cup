import { createClient } from "@supabase/supabase-js";
import type { Match, Prediction, User } from "./domain";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

type MatchRow = {
  id: string;
  group_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  venue: string;
  status: Match["status"];
  home_score: number | null;
  away_score: number | null;
};

type PredictionRow = {
  id: string;
  match_id: string;
  user_id: string;
  user_name: string;
  home_score: number;
  away_score: number;
  submitted_at: string;
};

type PlayerRow = {
  id: string;
  name: string;
  email: string;
};

function matchFromRow(row: MatchRow): Match {
  return {
    id: row.id,
    group: row.group_name,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoff: row.kickoff,
    venue: row.venue,
    status: row.status,
    homeScore: row.home_score ?? undefined,
    awayScore: row.away_score ?? undefined,
  };
}

function predictionFromRow(row: PredictionRow): Prediction {
  return {
    id: row.id,
    matchId: row.match_id,
    userId: row.user_id,
    userName: row.user_name,
    homeScore: row.home_score,
    awayScore: row.away_score,
    submittedAt: row.submitted_at,
  };
}

function playerFromRow(row: PlayerRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    method: "simple",
  };
}

export async function upsertProfile(user: User) {
  if (!supabase) return;
  const { error } = await supabase.from("players").upsert({
    id: user.id,
    name: user.name,
    email: user.email,
  });
  if (error) throw error;
}

export async function loadRemoteData() {
  if (!supabase) throw new Error("Supabase is not configured");

  const [matchesResult, predictionsResult, playersResult] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff", { ascending: true }),
    supabase.from("guest_predictions").select("*"),
    supabase.from("players").select("*"),
  ]);

  if (matchesResult.error) throw matchesResult.error;
  if (predictionsResult.error) throw predictionsResult.error;
  if (playersResult.error) throw playersResult.error;

  return {
    matches: (matchesResult.data as MatchRow[]).map(matchFromRow),
    predictions: (predictionsResult.data as PredictionRow[]).map(predictionFromRow),
    users: (playersResult.data as PlayerRow[]).map(playerFromRow),
  };
}

export async function saveRemotePrediction(prediction: Prediction) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("guest_predictions").upsert({
    id: prediction.id,
    match_id: prediction.matchId,
    user_id: prediction.userId,
    user_name: prediction.userName,
    home_score: prediction.homeScore,
    away_score: prediction.awayScore,
    submitted_at: prediction.submittedAt,
  });

  if (error) throw error;
}
