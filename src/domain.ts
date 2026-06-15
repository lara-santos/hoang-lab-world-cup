export type MatchStatus = "scheduled" | "live" | "finished";

export type Match = {
  id: string;
  group: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  venue: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  method: "google" | "simple";
};

export type Prediction = {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  homeScore: number;
  awayScore: number;
  submittedAt: string;
};

export function hasStarted(match: Match, now = new Date()): boolean {
  return new Date(match.kickoff).getTime() <= now.getTime();
}

export function canPredict(match: Match, now = new Date()): boolean {
  return !hasStarted(match, now);
}

export function resultOf(home: number, away: number): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function scorePrediction(
  prediction: Pick<Prediction, "homeScore" | "awayScore"> | undefined,
  match: Pick<Match, "homeScore" | "awayScore">,
): number {
  if (!prediction || match.homeScore === undefined || match.awayScore === undefined) {
    return 0;
  }

  const exactHome = prediction.homeScore === match.homeScore;
  const exactAway = prediction.awayScore === match.awayScore;
  const predictedResult = resultOf(prediction.homeScore, prediction.awayScore);
  const actualResult = resultOf(match.homeScore, match.awayScore);
  const resultMatches = predictedResult === actualResult;

  if (exactHome && exactAway) return 10;
  if (resultMatches && (exactHome || exactAway)) return 7;
  if (resultMatches) return 5;
  if (exactHome || exactAway) return 2;
  return 0;
}

export function pointsForUser(userId: string, matches: Match[], predictions: Prediction[]): number {
  return matches.reduce((total, match) => {
    const prediction = predictions.find((item) => item.userId === userId && item.matchId === match.id);
    return total + scorePrediction(prediction, match);
  }, 0);
}

export function pointsBreakdownForUser(userId: string, matches: Match[], predictions: Prediction[]) {
  return matches
    .filter((match) => match.homeScore !== undefined && match.awayScore !== undefined)
    .map((match) => {
      const prediction = predictions.find((item) => item.userId === userId && item.matchId === match.id);
      return {
        match,
        prediction,
        points: scorePrediction(prediction, match),
      };
    });
}
