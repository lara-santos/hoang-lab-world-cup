import { createClient } from "@supabase/supabase-js";

type PredictionBody = {
  id?: string;
  match_id?: string;
  user_id?: string;
  user_name?: string;
  home_score?: number;
  away_score?: number;
  submitted_at?: string;
};

type VercelRequest = {
  method?: string;
  body?: PredictionBody | string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function parseBody(body: VercelRequest["body"]): PredictionBody {
  if (!body) return {};
  return typeof body === "string" ? JSON.parse(body) : body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Missing Supabase server settings" });
  }

  const body = parseBody(req.body);
  if (
    !body.id ||
    !body.match_id ||
    !body.user_id ||
    !body.user_name ||
    body.home_score === undefined ||
    body.away_score === undefined
  ) {
    return res.status(400).json({ error: "Missing prediction fields" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("kickoff")
    .eq("id", body.match_id)
    .single();

  if (matchError) {
    return res.status(404).json({ error: "Match not found" });
  }

  if (new Date(match.kickoff).getTime() <= Date.now()) {
    return res.status(409).json({ error: "Predictions are closed for this match" });
  }

  const { error } = await supabase.from("guest_predictions").upsert({
    id: body.id,
    match_id: body.match_id,
    user_id: body.user_id,
    user_name: body.user_name,
    home_score: body.home_score,
    away_score: body.away_score,
    submitted_at: body.submitted_at ?? new Date().toISOString(),
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
