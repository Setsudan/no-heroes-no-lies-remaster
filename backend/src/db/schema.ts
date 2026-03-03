export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
}

export interface Hero {
  id: string;
  name: string;
  strength: number;
  default_spawn_amount: number;
  rarity: string;
  power1: string | null;
  power2: string | null;
  notes: string | null;
}

export interface Monster {
  id: string;
  name: string;
  strength: number;
  loot_coins: number;
  loot_gems: number;
  rarity: string;
  spawn_rate: number;
}

export interface Power {
  name: string;
  cost: number | null;
  target_type: string;
  is_passive: boolean;
  trigger_event: string | null;
  description: string;
}

export interface GameSession {
  id: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  created_by_user_id: string | null;
  winner_user_id: string | null;
  player_count: number;
  bot_count: number;
  rng_seed: string | null;
  final_coins_target: number;
  lobby_code: string | null;
  burned_heroes_count: number;
}

export interface GameSessionParticipant {
  id: string;
  session_id: string;
  user_id: string | null;
  is_bot: boolean;
  display_name: string;
  turn_order: number;
  final_hero_id: string | null;
  final_life: number | null;
  final_coins: number | null;
  final_gems: number | null;
  is_winner: boolean;
}

export interface GameSessionLog {
  id: string;
  session_id: string;
  seq: number;
  timestamp: string;
  actor_participant_id: string | null;
  event_type: string;
  payload: unknown;
  state_hash: string | null;
}

export interface GameSessionSnapshot {
  id: string;
  session_id: string;
  at_seq: number;
  snapshot: unknown;
}

