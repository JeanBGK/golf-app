"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Player,
  ScoresByHole,
  buildScoresByHole,
  calculateMatch,
  getBestBall,
} from "@/lib/scoring";

export default function LeaderboardPage() {
  const router = useRouter();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [scoresByHole, setScoresByHole] = useState<ScoresByHole>({});
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

    if (!players) return;
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

  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`leaderboard:${gameId}`)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full" />
      </div>
    );
  }

  const match = calculateMatch(allPlayers, scoresByHole);
  const allScores: Record<string, Record<number, number>> = {};
  for (const [hole, players] of Object.entries(scoresByHole)) {
    for (const [pid, strokes] of Object.entries(players)) {
      if (!allScores[pid]) allScores[pid] = {};
      allScores[pid][Number(hole)] = strokes;
    }
  }

  const sorted = [...allPlayers].sort((a, b) => {
    if (a.team !== b.team) return a.team < b.team ? -1 : 1;
    return a.sort_order - b.sort_order;
  });

  return (
    <div className="pb-20">
      <header className="bg-green-900 text-white py-3 text-center sticky top-0 z-50 shadow-md">
        <h1 className="text-lg font-bold">Leaderboard</h1>
        <p className="text-xs opacity-70">PIN: {gamePin}</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
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

        {/* Hole results grid */}
        <div className="bg-white rounded-xl p-4 shadow">
          <h2 className="text-lg font-bold text-green-900 mb-3">Match Results</h2>
          <div className="grid grid-cols-9 gap-1 mb-2">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((h) => {
              const hr = match.holeResults[h - 1];
              return (
                <div
                  key={h}
                  className={`py-2 rounded text-center text-xs font-bold ${
                    hr
                      ? hr.winner === "A"
                        ? "bg-blue-600 text-white"
                        : hr.winner === "B"
                        ? "bg-red-600 text-white"
                        : "bg-gray-300 text-gray-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <div className="text-[10px] opacity-70">{h}</div>
                  {hr ? (hr.winner === "halved" ? "=" : hr.winner) + (hr.shotTeam ? "*" : "") : "—"}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-9 gap-1">
            {Array.from({ length: 9 }, (_, i) => i + 10).map((h) => {
              const hr = match.holeResults[h - 1];
              return (
                <div
                  key={h}
                  className={`py-2 rounded text-center text-xs font-bold ${
                    hr
                      ? hr.winner === "A"
                        ? "bg-blue-600 text-white"
                        : hr.winner === "B"
                        ? "bg-red-600 text-white"
                        : "bg-gray-300 text-gray-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <div className="text-[10px] opacity-70">{h}</div>
                  {hr ? (hr.winner === "halved" ? "=" : hr.winner) + (hr.shotTeam ? "*" : "") : "—"}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">* = shot hole</p>
        </div>

        {/* Scorecard table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <h2 className="text-lg font-bold text-green-900 p-4 pb-2">Full Scorecard</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="bg-green-900 text-white">
                  <th className="py-2 px-2 text-left sticky left-0 bg-green-900 z-10">Player</th>
                  {Array.from({ length: 9 }, (_, i) => (
                    <th key={i + 1} className="py-2 px-1">{i + 1}</th>
                  ))}
                  <th className="py-2 px-1 bg-green-800">OUT</th>
                  {Array.from({ length: 9 }, (_, i) => (
                    <th key={i + 10} className="py-2 px-1">{i + 10}</th>
                  ))}
                  <th className="py-2 px-1 bg-green-800">IN</th>
                  <th className="py-2 px-1 bg-green-800">TOT</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  let outTotal = 0, inTotal = 0, outCount = 0, inCount = 0;
                  return (
                    <tr
                      key={p.id}
                      className={`border-b ${
                        p.team === "A" ? "border-l-4 border-l-blue-600" : "border-l-4 border-l-red-600"
                      }`}
                    >
                      <td className="py-2 px-2 font-semibold sticky left-0 bg-white z-10 whitespace-nowrap">
                        {p.name}
                      </td>
                      {Array.from({ length: 9 }, (_, i) => {
                        const h = i + 1;
                        const s = allScores[p.id]?.[h];
                        const isBest =
                          s != null &&
                          s === getBestBall(allPlayers, scoresByHole[h] || {}, p.team);
                        if (s != null) { outTotal += s; outCount++; }
                        return (
                          <td key={h} className={`py-2 px-1 text-center ${isBest ? "bg-yellow-100 font-bold" : ""}`}>
                            {s ?? ""}
                          </td>
                        );
                      })}
                      <td className="py-2 px-1 text-center font-bold bg-gray-50">
                        {outCount > 0 ? outTotal : ""}
                      </td>
                      {Array.from({ length: 9 }, (_, i) => {
                        const h = i + 10;
                        const s = allScores[p.id]?.[h];
                        const isBest =
                          s != null &&
                          s === getBestBall(allPlayers, scoresByHole[h] || {}, p.team);
                        if (s != null) { inTotal += s; inCount++; }
                        return (
                          <td key={h} className={`py-2 px-1 text-center ${isBest ? "bg-yellow-100 font-bold" : ""}`}>
                            {s ?? ""}
                          </td>
                        );
                      })}
                      <td className="py-2 px-1 text-center font-bold bg-gray-50">
                        {inCount > 0 ? inTotal : ""}
                      </td>
                      <td className="py-2 px-1 text-center font-bold bg-gray-50">
                        {outCount + inCount > 0 ? outTotal + inTotal : ""}
                      </td>
                    </tr>
                  );
                })}

                {/* Best ball rows */}
                {(["A", "B"] as const).map((team) => (
                  <tr key={team} className="bg-green-50 font-bold border-b">
                    <td className="py-2 px-2 sticky left-0 bg-green-50 z-10">Best T{team}</td>
                    {Array.from({ length: 9 }, (_, i) => {
                      const bb = getBestBall(allPlayers, scoresByHole[i + 1] || {}, team);
                      return <td key={i + 1} className="py-2 px-1 text-center">{bb ?? ""}</td>;
                    })}
                    <td className="py-2 px-1 text-center bg-green-100">
                      {Array.from({ length: 9 }, (_, i) => getBestBall(allPlayers, scoresByHole[i + 1] || {}, team))
                        .filter((v): v is number => v !== null)
                        .reduce((a, b) => a + b, 0) || ""}
                    </td>
                    {Array.from({ length: 9 }, (_, i) => {
                      const bb = getBestBall(allPlayers, scoresByHole[i + 10] || {}, team);
                      return <td key={i + 10} className="py-2 px-1 text-center">{bb ?? ""}</td>;
                    })}
                    <td className="py-2 px-1 text-center bg-green-100">
                      {Array.from({ length: 9 }, (_, i) => getBestBall(allPlayers, scoresByHole[i + 10] || {}, team))
                        .filter((v): v is number => v !== null)
                        .reduce((a, b) => a + b, 0) || ""}
                    </td>
                    <td className="py-2 px-1 text-center bg-green-100">
                      {Array.from({ length: 18 }, (_, i) => getBestBall(allPlayers, scoresByHole[i + 1] || {}, team))
                        .filter((v): v is number => v !== null)
                        .reduce((a, b) => a + b, 0) || ""}
                    </td>
                  </tr>
                ))}

                {/* Match result row */}
                <tr className="bg-green-900 text-white font-bold">
                  <td className="py-2 px-2 sticky left-0 bg-green-900 z-10">Match</td>
                  {Array.from({ length: 9 }, (_, i) => {
                    const hr = match.holeResults[i];
                    return (
                      <td key={i + 1} className="py-2 px-1 text-center">
                        {hr ? (hr.winner === "halved" ? "=" : hr.winner) + (hr.shotTeam ? "*" : "") : ""}
                      </td>
                    );
                  })}
                  <td className="py-2 px-1"></td>
                  {Array.from({ length: 9 }, (_, i) => {
                    const hr = match.holeResults[i + 9];
                    return (
                      <td key={i + 10} className="py-2 px-1 text-center">
                        {hr ? (hr.winner === "halved" ? "=" : hr.winner) + (hr.shotTeam ? "*" : "") : ""}
                      </td>
                    );
                  })}
                  <td className="py-2 px-1"></td>
                  <td className="py-2 px-1 text-center">
                    {match.teamAPoints}-{match.teamBPoints}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex z-50">
        <button
          onClick={() => router.push("/scoring")}
          className="flex-1 py-3 text-center text-gray-400 font-semibold text-sm"
        >
          <span className="block text-xl">&#9971;</span> Score
        </button>
        <button className="flex-1 py-3 text-center text-green-700 font-semibold text-sm">
          <span className="block text-xl">&#127942;</span> Board
        </button>
      </nav>
    </div>
  );
}
