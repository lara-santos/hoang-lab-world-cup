import { describe, expect, it } from "vitest";
import { pointsBreakdownForUser, pointsForUser, scorePrediction, type Match, type Prediction } from "./domain";

const finalScore = { homeScore: 2, awayScore: 1 };

describe("scorePrediction", () => {
  it("awards 10 points for an exact score", () => {
    expect(scorePrediction({ homeScore: 2, awayScore: 1 }, finalScore)).toBe(10);
  });

  it("awards 7 points for winner plus one correct score", () => {
    expect(scorePrediction({ homeScore: 2, awayScore: 0 }, finalScore)).toBe(7);
  });

  it("awards 5 points for the right result only", () => {
    expect(scorePrediction({ homeScore: 3, awayScore: 0 }, finalScore)).toBe(5);
  });

  it("awards 2 points for one correct score with the wrong result", () => {
    expect(scorePrediction({ homeScore: 0, awayScore: 1 }, finalScore)).toBe(2);
  });

  it("awards 0 points for a wrong prediction or missing prediction", () => {
    expect(scorePrediction({ homeScore: 0, awayScore: 3 }, finalScore)).toBe(0);
    expect(scorePrediction(undefined, finalScore)).toBe(0);
  });
});

describe("pointsForUser", () => {
  const matches: Match[] = [
    {
      id: "m1",
      group: "Group A",
      homeTeam: "A",
      awayTeam: "B",
      kickoff: "2026-06-11T15:00:00-04:00",
      venue: "One",
      status: "finished",
      homeScore: 2,
      awayScore: 1,
    },
    {
      id: "m2",
      group: "Group A",
      homeTeam: "C",
      awayTeam: "D",
      kickoff: "2026-06-12T15:00:00-04:00",
      venue: "Two",
      status: "finished",
      homeScore: 1,
      awayScore: 1,
    },
    {
      id: "m3",
      group: "Group B",
      homeTeam: "E",
      awayTeam: "F",
      kickoff: "2026-06-13T15:00:00-04:00",
      venue: "Three",
      status: "scheduled",
    },
  ];

  const predictions: Prediction[] = [
    {
      id: "p1",
      matchId: "m1",
      userId: "u1",
      userName: "User",
      homeScore: 2,
      awayScore: 1,
      submittedAt: "2026-06-10T15:00:00-04:00",
    },
    {
      id: "p2",
      matchId: "m2",
      userId: "u1",
      userName: "User",
      homeScore: 0,
      awayScore: 0,
      submittedAt: "2026-06-10T15:00:00-04:00",
    },
    {
      id: "p3",
      matchId: "m3",
      userId: "u1",
      userName: "User",
      homeScore: 3,
      awayScore: 0,
      submittedAt: "2026-06-10T15:00:00-04:00",
    },
  ];

  it("adds points across finished games and ignores games without final scores", () => {
    expect(pointsForUser("u1", matches, predictions)).toBe(15);
  });

  it("returns a finished-game breakdown for each user", () => {
    expect(pointsBreakdownForUser("u1", matches, predictions).map((item) => item.points)).toEqual([10, 5]);
  });
});
