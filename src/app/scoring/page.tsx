"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Player,
  ScoresByHole,
  buildScoresByHole,
  calculateMatch,
  getBestBall,
} from "@/lib/scoring";

function ScoringContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [flightPlayers, setFlightPlayers] = useState<Player[]>([]);
  const [scoresByHole, setScoresByHole] = useState<ScoresByHole>({});
  const [currentHole, setCurrentHole] = useState(1);
  const [myFlight, setMyFlight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gamePin, setGamePin] = useState<string | null>(null);

  const loadGame = useCallback(async () => {
    const id = sessionStorage.getItem("golf_game_id");
    const pin = sessionStorage.getItem("golf_game_pin");
    if (!id || !pin) {
      router.push("/");
      return;
    }
    setGameId(id);
    setGamePin(pin);

    const { data: players } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", id)
      .order("sort_order");

    if (!players || players.length === 0) {
      router.push("/");
      return;
    }

    setAllPlayers(players as Player[]);

    const { data: scores } = await supabase
      .from("scores")
      .select("*")
      .eq("game_id", id);

    setScoresByHole(buildScoresByHole(scores ?? []));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // Subscribe to real-time score updates
  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`scores:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const s = payload.new as { player_id: string; hole: number; strokes: number };
          if (!s) return;
          setScoresByHole((prev) => ({
            ...prev,
            [s.hole]: { ...prev[s.hole], [s.player_id]: s.strokes },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Handle flight selection from URL
  useEffect(() => {
    if (allPlayers.length === 0) return;
    const flightParam = searchParams.get("flight");
    const saved = sessionStorage.getItem("golf_flight");

    if (flightParam && flightParam !== "pick") {
      selectFlight(Number(flightParam));
    } else if (saved && flightParam !== "pick") {
      selectFlight(Number(saved));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlayers, searchParams]);

  function selectFlight(f: number) {
    setMyFlight(f);
    sessionStorage.setItem("golf_flight", String(f));
    setFlightPlayers(allPlayers.filter((p) => p.flight === f));
  }

  async function adjustScore(playerId: string, delta: number) {
    if (!gameId) return;

    const current = scoresByHole[currentHole]?.[playerId] ?? null;
    let newVal: number;
    if (current === null) {
      newVal = delta > 0 ? 4 : 3;
    } else {
      newVal = current + delta;
    }
    if (newVal < 1) newVal = 1;
    if (newVal > 20) newVal = 20;

    // Optimistic update
    setScoresByHole((prev) => ({
      ...prev,
      [currentHole]: { ...prev[currentHole], [playerId]: newVal },
    }));

    await supabase.from("scores").upsert(
      {
        game_id: gameId,
        player_id: playerId,
        hole: currentHole,
        strokes: newVal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id,hole" }
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full" />
      </div>
    );
  }

  // Flight picker
  if (myFlight === null) {
    return (
      <div>
        <header className="bg-green-900 text-white py-5 text-center">
          <h1 className="text-2xl font-bold">Select Your Flight</h1>
          <p className="text-sm opacity-80 mt-1">Which flight are you scoring?</p>
        </header>
        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          {[1, 2].map((f) => {
            const fp = allPlayers.filter((p) => p.flight === f);
            return (
              <div key={f} className="bg-white rounded-xl p-6 shadow">
                <h2 className="text-lg font-bold text-green-900 mb-3">Flight {f}</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  {fp.map((p) => (
                    <span
                      key={p.id}
                      className={`text-white text-xs font-bold px-3 py-1 rounded-full ${
                        p.team === "A" ? "bg-blue-600" : "bg-red-600"
                      }`}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => selectFlight(f)}
                  className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-lg transition"
                >
                  Score Flight {f}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Main scoring UI
  const match = calculateMatch(allPlayers, scoresByHole);
  const holeScores = scoresByHole[currentHole] || {};

  return (
    <div className="pb-20">
      <header className="bg-green-900 text-white py-3 text-center sticky top-0 z-50 shadow-md">
        <h1 className="text-lg font-bold">Flight {myFlight}</h1>
        <p className="text-xs opacity-70">PIN: {gamePin}</p>
      </header>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Scoreboard */}
        <div className="bg-green-900 rounded-xl p-4 flex items-center text-white">
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold opacity-80">Team A</p>
            <p className="text-4xl font-black">{match.teamAPoints}</p>
          </div>
          <div className="text-sm opacity-50">VS</div>
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold opacity-80">Team B</p>
            <p className="text-4xl font-black">{match.teamBPoints}</p>
          </div>
        </div>

        {match.shotTeam && (
          <div className="bg-yellow-400 text-gray-900 text-center py-2 px-4 rounded-lg text-sm font-bold">
            Team {match.shotTeam} has a shot (trailing by 2+)
          </div>
        )}

        {/* Hole navigation */}
        <div className="grid grid-cols-9 gap-1">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((h) => {
            const hr = match.holeResults[h - 1];
            return (
              <button
                key={h}
                onClick={() => setCurrentHole(h)}
                className={`py-2 rounded text-xs font-bold transition ${
                  h === currentHole
                    ? "bg-green-700 text-white"
                    : hr
                    ? hr.winner === "A"
                      ? "bg-blue-100 text-blue-800 border-b-2 border-blue-600"
                      : hr.winner === "B"
                      ? "bg-red-100 text-red-800 border-b-2 border-red-600"
                      : "bg-gray-100 text-gray-600 border-b-2 border-gray-400"
                    : "bg-white text-gray-500 border border-gray-200"
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-9 gap-1">
          {Array.from({ length: 9 }, (_, i) => i + 10).map((h) => {
            const hr = match.holeResults[h - 1];
            return (
              <button
                key={h}
                onClick={() => setCurrentHole(h)}
                className={`py-2 rounded text-xs font-bold transition ${
                  h === currentHole
                    ? "bg-green-700 text-white"
                    : hr
                    ? hr.winner === "A"
                      ? "bg-blue-100 text-blue-800 border-b-2 border-blue-600"
                      : hr.winner === "B"
                      ? "bg-red-100 text-red-800 border-b-2 border-red-600"
                      : "bg-gray-100 text-gray-600 border-b-2 border-gray-400"
                    : "bg-white text-gray-500 border border-gray-200"
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>

        {/* Current hole header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-green-900">Hole {currentHole}</h3>
          <div className="flex gap-2">
            <button
              disabled={currentHole <= 1}
              onClick={() => setCurrentHole((h) => h - 1)}
              className="w-10 h-10 border-2 border-green-700 rounded-lg text-green-700 font-bold disabled:opacity-30"
            >
              &larr;
            </button>
            <button
              disabled={currentHole >= 18}
              onClick={() => setCurrentHole((h) => h + 1)}
              className="w-10 h-10 border-2 border-green-700 rounded-lg text-green-700 font-bold disabled:opacity-30"
            >
              &rarr;
            </button>
          </div>
        </div>

        {/* Score entries */}
        {flightPlayers.map((player) => {
          const strokes = holeScores[player.id] ?? null;
          const bestForTeam = getBestBall(flightPlayers, holeScores, player.team);
          const isBest = strokes !== null && strokes === bestForTeam;

          return (
            <div
              key={player.id}
              className={`bg-white rounded-xl p-4 shadow ${
                isBest ? "border-l-4 border-yellow-400" : ""
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold">{player.name}</span>
                <span
                  className={`text-white text-xs font-bold px-3 py-1 rounded-full ${
                    player.team === "A" ? "bg-blue-600" : "bg-red-600"
                  }`}
                >
                  Team {player.team}
                </span>
              </div>
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => adjustScore(player.id, -1)}
                  className="w-14 h-14 rounded-full bg-red-50 text-red-600 text-2xl font-bold active:scale-90 transition"
                >
                  -
                </button>
                <span
                  className={`text-4xl font-black min-w-[3rem] text-center ${
                    strokes === null ? "text-gray-300" : "text-green-900"
                  }`}
                >
                  {strokes ?? "—"}
                </span>
                <button
                  onClick={() => adjustScore(player.id, 1)}
                  className="w-14 h-14 rounded-full bg-green-50 text-green-700 text-2xl font-bold active:scale-90 transition"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex z-50">
        <button className="flex-1 py-3 text-center text-green-700 font-semibold text-sm">
          <span className="block text-xl">&#9971;</span> Score
        </button>
        <button
          onClick={() => router.push("/leaderboard")}
          className="flex-1 py-3 text-center text-gray-400 font-semibold text-sm"
        >
          <span className="block text-xl">&#127942;</span> Board
        </button>
      </nav>
    </div>
  );
}

export default function ScoringPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full" />
        </div>
      }
    >
      <ScoringContent />
    </Suspense>
  );
}
