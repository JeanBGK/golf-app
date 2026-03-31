-- Golf Team Scoring App — Supabase Schema
-- Run this in your Supabase SQL Editor

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS games CASCADE;

-- Games table
CREATE TABLE games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pin TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'complete')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    team TEXT NOT NULL CHECK (team IN ('A', 'B')),
    flight INTEGER NOT NULL CHECK (flight IN (1, 2)),
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Scores table
CREATE TABLE scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    hole INTEGER NOT NULL CHECK (hole >= 1 AND hole <= 18),
    strokes INTEGER NOT NULL CHECK (strokes >= 1 AND strokes <= 20),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, hole)
);

-- Indexes
CREATE INDEX idx_players_game ON players(game_id);
CREATE INDEX idx_scores_game ON scores(game_id);
CREATE INDEX idx_scores_player ON scores(player_id);
CREATE INDEX idx_games_pin ON games(pin);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can create games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read games" ON games FOR SELECT USING (true);
CREATE POLICY "Anyone can update games" ON games FOR UPDATE USING (true);

CREATE POLICY "Anyone can read players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON players FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete players" ON players FOR DELETE USING (true);

CREATE POLICY "Anyone can read scores" ON scores FOR SELECT USING (true);
CREATE POLICY "Anyone can insert scores" ON scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update scores" ON scores FOR UPDATE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
