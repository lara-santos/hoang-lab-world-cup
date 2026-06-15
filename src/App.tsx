import {
  CalendarClock,
  CalendarDays,
  EyeOff,
  Info,
  ListFilter,
  LogIn,
  RefreshCw,
  Rows3,
  Trophy,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { demoUsers, seedPredictions } from "./data";
import {
  canPredict,
  hasStarted,
  pointsBreakdownForUser,
  pointsForUser,
  scorePrediction,
  type Match,
  type Prediction,
  type User,
} from "./domain";
import { syncMatches } from "./fifa";
import {
  isSupabaseConfigured,
  loadRemoteData,
  saveRemotePrediction,
  upsertProfile,
} from "./supabase";

const USER_KEY = "lab-bolao-user";
const PREDICTIONS_KEY = "lab-bolao-predictions";

type AppView = "matches" | "leaderboard";
type SortMode = "date" | "group";

function loadUser(): User | null {
  const saved = localStorage.getItem(USER_KEY);
  return saved ? JSON.parse(saved) : null;
}

function loadPredictions(): Prediction[] {
  const saved = localStorage.getItem(PREDICTIONS_KEY);
  return saved ? JSON.parse(saved) : seedPredictions;
}

function savePredictions(predictions: Prediction[]) {
  localStorage.setItem(PREDICTIONS_KEY, JSON.stringify(predictions));
}

function groupOrder(group: string): number {
  const letter = group.match(/Group\s+([A-L])/i)?.[1]?.toUpperCase() ?? "Z";
  return letter.charCodeAt(0);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function userIdFromEmail(email: string): string {
  return `guest-${email.trim().toLowerCase()}`.replace(/[^a-z0-9-@.]/g, "-");
}

function SignIn({ onSignIn }: { onSignIn: (user: User) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setNotice("Add your name and email.");
      return;
    }

    const user: User = {
      id: isSupabaseConfigured ? userIdFromEmail(email) : `u-${email.trim().toLowerCase()}`.replace(/[^a-z0-9-]/g, "-"),
      name: name.trim(),
      email: email.trim(),
      method: "simple",
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (isSupabaseConfigured) {
      try {
        await upsertProfile(user);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not save your profile.");
        return;
      }
    }
    onSignIn(user);
  }

  return (
    <main className="signin-shell">
      <section className="signin-panel">
        <div>
          <p className="eyebrow">World Cup lab pool</p>
          <h1>Hoang Lab World Cup</h1>
          <p className="lede">
            Predict every match, lock guesses at kickoff, reveal the lab's picks when the game starts, and let the
            scoreboard update itself after the final whistle.
          </p>
        </div>
        <form onSubmit={submit} className="signin-form">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          </label>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@lab.edu" />
          </label>
          <button type="submit">
            <LogIn size={18} />
            Enter pool
          </button>
          {notice && <p className="form-notice">{notice}</p>}
        </form>
      </section>
    </main>
  );
}

function Leaderboard({ users, matches, predictions }: { users: User[]; matches: Match[]; predictions: Prediction[] }) {
  const matchIds = new Set(matches.map((match) => match.id));
  const standings = users
    .map((user) => {
      const breakdown = pointsBreakdownForUser(user.id, matches, predictions);
      return {
        ...user,
        breakdown,
        points: breakdown.reduce((total, item) => total + item.points, 0),
        picks: predictions.filter((prediction) => prediction.userId === user.id && matchIds.has(prediction.matchId)).length,
      };
    })
    .sort((a, b) => b.points - a.points || b.picks - a.picks);

  return (
    <section className="leaderboard page-panel">
      <div className="panel-title">
        <Trophy size={18} />
        <h2>Leaderboard</h2>
      </div>
      {standings.map((user, index) => (
        <div className="standing-card" key={user.id}>
          <div className="standing">
            <span className="rank">{index + 1}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.picks} picks / {user.breakdown.length} scored games
              </small>
            </div>
            <b>{user.points}</b>
          </div>
          <details className="score-breakdown">
            <summary>See picks</summary>
            <div className="score-breakdown-list">
              {user.breakdown.map(({ match, prediction, points }) => (
                <div className="score-chip" key={match.id}>
                  <span>
                    {match.homeTeam} {match.homeScore}-{match.awayScore} {match.awayTeam}
                  </span>
                  <small>{prediction ? `${prediction.homeScore}-${prediction.awayScore}` : "No pick"}</small>
                  <b>+{points}</b>
                </div>
              ))}
              {!user.breakdown.length && <p className="empty">No finished games yet.</p>}
            </div>
          </details>
        </div>
      ))}
    </section>
  );
}

function PointsGuide() {
  const rules = [
    ["10", "Exact score"],
    ["7", "Winner or draw plus one correct team score"],
    ["5", "Winner or draw only"],
    ["2", "One correct team score only"],
    ["0", "Wrong or missing pick"],
  ];

  return (
    <section className="points-guide">
      <div className="panel-title compact">
        <Info size={16} />
        <h2>Points</h2>
      </div>
      <div className="rules-grid">
        {rules.map(([points, label]) => (
          <div className="rule" key={points}>
            <strong>{points}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchControls({
  nextOnly,
  sortMode,
  onNextOnlyChange,
  onSortModeChange,
}: {
  nextOnly: boolean;
  sortMode: SortMode;
  onNextOnlyChange: (value: boolean) => void;
  onSortModeChange: (value: SortMode) => void;
}) {
  return (
    <section className="controls-row">
      <label className="toggle-control">
        <input checked={nextOnly} onChange={(event) => onNextOnlyChange(event.target.checked)} type="checkbox" />
        <span>
          <ListFilter size={16} />
          Next games only
        </span>
      </label>
      <div className="segmented" aria-label="Sort matches">
        <button className={sortMode === "date" ? "active" : ""} onClick={() => onSortModeChange("date")} type="button">
          <CalendarDays size={16} />
          Date
        </button>
        <button className={sortMode === "group" ? "active" : ""} onClick={() => onSortModeChange("group")} type="button">
          <Rows3 size={16} />
          Group
        </button>
      </div>
    </section>
  );
}

function PredictionForm({
  match,
  user,
  predictions,
  onSave,
}: {
  match: Match;
  user: User;
  predictions: Prediction[];
  onSave: (prediction: Prediction) => void;
}) {
  const existing = predictions.find((prediction) => prediction.userId === user.id && prediction.matchId === match.id);
  const [homeScore, setHomeScore] = useState(existing?.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(existing?.awayScore ?? 0);
  const locked = !canPredict(match);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    onSave({
      id: existing?.id ?? `${user.id}-${match.id}`,
      matchId: match.id,
      userId: user.id,
      userName: user.name,
      homeScore,
      awayScore,
      submittedAt: new Date().toISOString(),
    });
  }

  return (
    <form className="prediction-form" data-testid={`prediction-form-${match.id}`} onSubmit={submit}>
      <input
        aria-label={`${match.homeTeam} predicted goals`}
        disabled={locked}
        min={0}
        type="number"
        value={homeScore}
        onChange={(event) => setHomeScore(Number(event.target.value))}
      />
      <span>:</span>
      <input
        aria-label={`${match.awayTeam} predicted goals`}
        disabled={locked}
        min={0}
        type="number"
        value={awayScore}
        onChange={(event) => setAwayScore(Number(event.target.value))}
      />
      <button data-testid={`save-${match.id}`} disabled={locked} type="submit">
        Save
      </button>
    </form>
  );
}

function MatchCard({
  match,
  user,
  predictions,
  onSave,
}: {
  match: Match;
  user: User;
  predictions: Prediction[];
  onSave: (prediction: Prediction) => void;
}) {
  const reveal = hasStarted(match);
  const matchPredictions = predictions.filter((prediction) => prediction.matchId === match.id);
  const myPrediction = matchPredictions.find((prediction) => prediction.userId === user.id);
  const scoreReady = match.homeScore !== undefined && match.awayScore !== undefined;

  return (
    <article className="match-card" data-testid={`match-${match.id}`}>
      <header>
        <div>
          <p>{match.group}</p>
          <h3>
            {match.homeTeam} <span>vs</span> {match.awayTeam}
          </h3>
        </div>
        <span className={`status ${match.status}`}>{match.status}</span>
      </header>
      <div className="match-meta">
        <span>
          <CalendarClock size={16} />
          {displayDate(match.kickoff)}
        </span>
        <span>{match.venue}</span>
      </div>
      <div className="score-row">
        <strong>{scoreReady ? `${match.homeScore} : ${match.awayScore}` : "Score pending"}</strong>
        <small>{myPrediction ? `Your pick: ${myPrediction.homeScore} : ${myPrediction.awayScore}` : "No pick yet"}</small>
      </div>
      <PredictionForm match={match} user={user} predictions={predictions} onSave={onSave} />
      <section className="prediction-list">
        <div className="panel-title compact">
          {reveal ? <Users size={16} /> : <EyeOff size={16} />}
          <h4>{reveal ? "Lab predictions" : "Hidden until kickoff"}</h4>
        </div>
        {reveal ? (
          matchPredictions.length ? (
            matchPredictions.map((prediction) => (
              <div className="pick" key={prediction.id}>
                <span>{prediction.userName}</span>
                <strong>
                  {prediction.homeScore} : {prediction.awayScore}
                </strong>
                <b>{scorePrediction(prediction, match)} pts</b>
              </div>
            ))
          ) : (
            <p className="empty">Nobody predicted this match.</p>
          )
        ) : (
          <p className="empty">Other picks stay private until this match starts.</p>
        )}
      </section>
    </article>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(() => loadUser());
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>(() => loadPredictions());
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);
  const [syncState, setSyncState] = useState("Sample fixtures; FIFA feed not connected");
  const [activeView, setActiveView] = useState<AppView>("matches");
  const [nextOnly, setNextOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("date");

  useEffect(() => {
    async function loadData() {
      if (isSupabaseConfigured && user) {
        await upsertProfile(user);
        const remote = await loadRemoteData();
        setMatches(remote.matches);
        const localMine = loadPredictions().filter((prediction) => prediction.userId === user.id);
        const remoteIds = new Set(remote.predictions.map((prediction) => prediction.id));
        setPredictions([...remote.predictions, ...localMine.filter((prediction) => !remoteIds.has(prediction.id))]);
        setRemoteUsers(remote.users);
        setSyncState("Connected to Supabase shared database");
        return;
      }

      const items = await syncMatches();
      setMatches(items);
      setSyncState(
        import.meta.env.VITE_FIFA_MATCHES_URL ? "Synced from configured FIFA feed" : "Sample fixtures; FIFA feed not connected",
      );
    }

    loadData().catch(() => {
      setSyncState(isSupabaseConfigured ? "Supabase load failed" : "FIFA sync failed; using sample fixtures");
    });
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;

    const interval = window.setInterval(() => {
      loadRemoteData()
        .then((remote) => {
          const localMine = loadPredictions().filter((prediction) => prediction.userId === user.id);
          const remoteIds = new Set(remote.predictions.map((prediction) => prediction.id));
          setMatches(remote.matches);
          setPredictions([...remote.predictions, ...localMine.filter((prediction) => !remoteIds.has(prediction.id))]);
          setRemoteUsers(remote.users);
        })
        .catch(() => {
          setSyncState("Supabase refresh failed");
        });
    }, 30000);

    return () => window.clearInterval(interval);
  }, [user]);

  const visibleMatches = useMemo(() => {
    const filtered = nextOnly ? matches.filter((match) => !hasStarted(match)) : matches;
    return [...filtered].sort((a, b) => {
      if (sortMode === "group") {
        return groupOrder(a.group) - groupOrder(b.group) || new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
      }
      return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
    });
  }, [matches, nextOnly, sortMode]);

  const validMatchIds = useMemo(() => new Set(matches.map((match) => match.id)), [matches]);
  const myPickCount = user
    ? predictions.filter((prediction) => prediction.userId === user.id && validMatchIds.has(prediction.matchId)).length
    : 0;

  const users = useMemo(() => {
    const map = new Map<string, User>();
    const baseUsers = isSupabaseConfigured ? remoteUsers : demoUsers;
    baseUsers.forEach((item) => map.set(item.id, item));
    if (user) map.set(user.id, user);
    predictions.forEach((prediction) => {
      if (!map.has(prediction.userId)) {
        map.set(prediction.userId, {
          id: prediction.userId,
          name: prediction.userName,
          email: "",
          method: "simple",
        });
      }
    });
    return [...map.values()];
  }, [predictions, remoteUsers, user]);

  async function savePrediction(prediction: Prediction) {
    const next = [...predictions.filter((item) => item.id !== prediction.id), prediction];
    setPredictions(next);
    if (isSupabaseConfigured) {
      savePredictions(next.filter((item) => item.userId === prediction.userId));
      await saveRemotePrediction(prediction);
    } else {
      savePredictions(next);
    }
  }

  async function signOut() {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setRemoteUsers([]);
  }

  if (!user) {
    return <SignIn onSignIn={setUser} />;
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div>
          <p className="eyebrow">Hoang Lab World Cup</p>
          <h1>World Cup predictions</h1>
        </div>
        <div className="user-chip">
          <span>{user.name}</span>
          <button className="text-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>

      <section className="summary-band">
        <div>
          <strong>{matches.length}</strong>
          <span>matches</span>
        </div>
        <div>
          <strong>{myPickCount}</strong>
          <span>your picks</span>
        </div>
        <div>
          <strong>{pointsForUser(user.id, matches, predictions)}</strong>
          <span>your points</span>
        </div>
        <button className="sync-pill" onClick={() => window.location.reload()}>
          <RefreshCw size={16} />
          {syncState}
        </button>
      </section>

      <section className="tabs" aria-label="App sections">
        <button className={activeView === "matches" ? "active" : ""} onClick={() => setActiveView("matches")} type="button">
          <CalendarDays size={17} />
          Matches
        </button>
        <button
          className={activeView === "leaderboard" ? "active" : ""}
          onClick={() => setActiveView("leaderboard")}
          type="button"
        >
          <Trophy size={17} />
          Leaderboard
        </button>
      </section>

      {activeView === "matches" ? (
        <section className="page-stack">
          <PointsGuide />
          <MatchControls
            nextOnly={nextOnly}
            sortMode={sortMode}
            onNextOnlyChange={setNextOnly}
            onSortModeChange={setSortMode}
          />
          <section className="matches">
            {visibleMatches.map((match) => (
              <MatchCard key={match.id} match={match} user={user} predictions={predictions} onSave={savePrediction} />
            ))}
          </section>
        </section>
      ) : (
        <section className="page-stack">
          <PointsGuide />
          <Leaderboard users={users} matches={matches} predictions={predictions} />
        </section>
      )}
    </main>
  );
}
