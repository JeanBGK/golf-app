"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [hasActive, setHasActive] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem("golf_game_id");
    if (id) setHasActive(true);
  }, []);

  async function joinGame() {
    setError("");
    if (!pin || pin.length !== 6) {
      setError("Please enter a 6-digit PIN");
      return;
    }
    setJoining(true);
    const { data: game, error: err } = await supabase
      .from("games")
      .select("*")
      .eq("pin", pin)
      .single();

    if (err || !game) {
      setError("Game not found. Check the PIN and try again.");
      setJoining(false);
      return;
    }

    sessionStorage.setItem("golf_game_id", game.id);
    sessionStorage.setItem("golf_game_pin", pin);
    router.push("/scoring?flight=pick");
  }

  function continueGame() {
    const flight = sessionStorage.getItem("golf_flight");
    router.push(flight ? `/scoring?flight=${flight}` : "/scoring?flight=pick");
  }

  return (
    <div>
      <header className="bg-green-900 text-white py-5 text-center sticky top-0 z-50 shadow-md">
        <h1 className="text-2xl font-bold tracking-wide">Golf Team Match</h1>
        <p className="text-sm opacity-80 mt-1">Best Ball Team Scoring</p>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-xl p-6 shadow text-center">
          <h2 className="text-lg font-bold text-green-900 mb-2">Start a New Game</h2>
          <p className="text-gray-500 mb-4 text-sm">Set up teams, flights, and players</p>
          <button
            onClick={() => router.push("/setup")}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-lg transition"
          >
            Create Game
          </button>
        </div>

        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-bold text-green-900 mb-2">Join a Game</h2>
          <p className="text-gray-500 mb-4 text-sm">Enter the game PIN from your captain</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter 6-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyUp={(e) => e.key === "Enter" && joinGame()}
            className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-lg focus:border-green-600 outline-none mb-3"
          />
          {error && (
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-3">{error}</p>
          )}
          <button
            onClick={joinGame}
            disabled={joining}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {joining ? "Joining..." : "Join Game"}
          </button>
        </div>

        {hasActive && (
          <div className="bg-white rounded-xl p-6 shadow">
            <h2 className="text-lg font-bold text-green-900 mb-2">Continue Game</h2>
            <p className="text-gray-500 mb-3 text-sm">You have an active game</p>
            <button
              onClick={continueGame}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-lg transition"
            >
              Return to Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
