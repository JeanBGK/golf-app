"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface PlayerRow {
  name: string;
  team: "A" | "B";
  flight: 1 | 2;
}

export default function SetupPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerRow[]>([
    { name: "", team: "A", flight: 1 },
    { name: "", team: "B", flight: 1 },
    { name: "", team: "A", flight: 2 },
    { name: "", team: "B", flight: 2 },
  ]);
  const [errors, setErrors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [gamePin, setGamePin] = useState<string | null>(null);

  function updatePlayer(i: number, field: keyof PlayerRow, value: string | number) {
    setPlayers((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [field]: value };
      return copy;
    });
  }

  function removePlayer(i: number) {
    setPlayers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addPlayer() {
    if (players.length >= 8) return;
    setPlayers((prev) => [...prev, { name: "", team: "A", flight: 1 }]);
  }

  function validate(): string[] {
    const filled = players.filter((p) => p.name.trim());
    const errs: string[] = [];
    if (filled.length < 2) errs.push("Need at least 2 players.");
    if (!filled.some((p) => p.team === "A")) errs.push("Team A has no players.");
    if (!filled.some((p) => p.team === "B")) errs.push("Team B has no players.");
    if (!filled.some((p) => p.flight === 1)) errs.push("Flight 1 has no players.");
    if (!filled.some((p) => p.flight === 2)) errs.push("Flight 2 has no players.");

    const f1 = filled.filter((p) => p.flight === 1);
    const f2 = filled.filter((p) => p.flight === 2);
    if (f1.length > 0 && new Set(f1.map((p) => p.team)).size < 2)
      errs.push("Flight 1 needs players from both teams.");
    if (f2.length > 0 && new Set(f2.map((p) => p.team)).size < 2)
      errs.push("Flight 2 needs players from both teams.");

    return errs;
  }

  async function createGame() {
    const filled = players.filter((p) => p.name.trim());
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setCreating(true);

    const pin = String(Math.floor(100000 + Math.random() * 900000));

    const { data: game, error: gameErr } = await supabase
      .from("games")
      .insert({ pin, status: "setup" })
      .select()
      .single();

    if (gameErr || !game) {
      setErrors(["Error creating game: " + (gameErr?.message ?? "Unknown error")]);
      setCreating(false);
      return;
    }

    const rows = filled.map((p, i) => ({
      game_id: game.id,
      name: p.name.trim(),
      team: p.team,
      flight: p.flight,
      sort_order: i,
    }));

    const { error: playersErr } = await supabase.from("players").insert(rows);

    if (playersErr) {
      setErrors(["Error adding players: " + playersErr.message]);
      setCreating(false);
      return;
    }

    sessionStorage.setItem("golf_game_id", game.id);
    sessionStorage.setItem("golf_game_pin", pin);
    setGamePin(pin);
  }

  async function startGame() {
    const gameId = sessionStorage.getItem("golf_game_id");
    if (!gameId) return;
    await supabase.from("games").update({ status: "active" }).eq("id", gameId);
    router.push("/scoring?flight=pick");
  }

  if (gamePin) {
    const filled = players.filter((p) => p.name.trim());
    const teamA = filled.filter((p) => p.team === "A");
    const teamB = filled.filter((p) => p.team === "B");

    return (
      <div>
        <header className="bg-green-900 text-white py-5 text-center">
          <h1 className="text-2xl font-bold">Game Created!</h1>
        </header>
        <div className="max-w-md mx-auto px-4 py-6 space-y-4">
          <div className="bg-green-50 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500 mb-2">Share this PIN with the other captain</p>
            <p className="text-5xl font-black tracking-[0.3em] text-green-900 font-mono">
              {gamePin}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow">
            <h2 className="text-lg font-bold text-green-900 mb-3">Teams</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
                  Team A
                </span>
                {teamA.map((p, i) => (
                  <p key={i} className="text-sm py-1">
                    {p.name}{" "}
                    <span className="text-gray-400 text-xs">F{p.flight}</span>
                  </p>
                ))}
              </div>
              <div>
                <span className="inline-block bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
                  Team B
                </span>
                {teamB.map((p, i) => (
                  <p key={i} className="text-sm py-1">
                    {p.name}{" "}
                    <span className="text-gray-400 text-xs">F{p.flight}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={startGame}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-4 rounded-lg text-lg transition"
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="bg-green-900 text-white py-5 text-center">
        <h1 className="text-2xl font-bold">Game Setup</h1>
        <p className="text-sm opacity-80 mt-1">Add players, assign teams &amp; flights</p>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-bold text-green-900 mb-4">
            Players ({players.length}/8)
          </h2>

          <div className="space-y-3">
            {players.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Player name"
                  value={p.name}
                  onChange={(e) => updatePlayer(i, "name", e.target.value)}
                  className="flex-1 min-w-0 border-2 border-gray-200 rounded-lg px-3 py-2.5 focus:border-green-600 outline-none"
                />
                <select
                  value={p.team}
                  onChange={(e) => updatePlayer(i, "team", e.target.value)}
                  className="border-2 border-gray-200 rounded-lg px-2 py-2.5 focus:border-green-600 outline-none"
                >
                  <option value="A">Team A</option>
                  <option value="B">Team B</option>
                </select>
                <select
                  value={p.flight}
                  onChange={(e) => updatePlayer(i, "flight", Number(e.target.value))}
                  className="border-2 border-gray-200 rounded-lg px-2 py-2.5 focus:border-green-600 outline-none"
                >
                  <option value={1}>F1</option>
                  <option value={2}>F2</option>
                </select>
                <button
                  onClick={() => removePlayer(i)}
                  className="text-red-500 text-xl font-bold px-2 hover:text-red-700"
                >
                  x
                </button>
              </div>
            ))}
          </div>

          {players.length < 8 && (
            <button
              onClick={addPlayer}
              className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition"
            >
              + Add Player
            </button>
          )}
        </div>

        {errors.length > 0 && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        <button
          onClick={createGame}
          disabled={creating}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-4 rounded-lg text-lg transition"
        >
          {creating ? "Creating..." : "Create Game"}
        </button>

        <button
          onClick={() => router.push("/")}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
