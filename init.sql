-- PostgreSQL initialization script for No Heroes No Lies backend

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users and authentication

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(50) NOT NULL UNIQUE,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip varchar(64),
  user_agent text
);

-- Reference data: heroes, monsters, powers

CREATE TABLE IF NOT EXISTS heroes (
  id varchar(64) PRIMARY KEY,
  name varchar(100) NOT NULL,
  strength integer NOT NULL,
  default_spawn_amount integer NOT NULL,
  rarity varchar(32) NOT NULL,
  power1 varchar(64),
  power2 varchar(64),
  notes text
);

CREATE TABLE IF NOT EXISTS monsters (
  id varchar(64) PRIMARY KEY,
  name varchar(100) NOT NULL,
  strength integer NOT NULL,
  loot_coins integer NOT NULL,
  loot_gems integer NOT NULL,
  rarity varchar(32) NOT NULL,
  spawn_rate numeric(5,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS powers (
  name varchar(64) PRIMARY KEY,
  cost integer,
  target_type varchar(32) NOT NULL,
  is_passive boolean NOT NULL DEFAULT false,
  trigger_event varchar(64),
  description text NOT NULL
);

-- Game sessions and participants

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  status varchar(32) NOT NULL,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  winner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  player_count integer NOT NULL,
  bot_count integer NOT NULL DEFAULT 0,
  rng_seed bigint,
  final_coins_target integer NOT NULL,
  lobby_code varchar(16) UNIQUE,
  burned_heroes_count integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS game_session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_bot boolean NOT NULL DEFAULT false,
  display_name varchar(50) NOT NULL,
  turn_order integer NOT NULL,
  final_hero_id varchar(64) REFERENCES heroes(id),
  final_life integer,
  final_coins integer,
  final_gems integer,
  is_winner boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_game_session_participants_session
  ON game_session_participants(session_id);

-- Logs and snapshots for replay and anti-cheat

CREATE TABLE IF NOT EXISTS game_session_logs (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  actor_participant_id uuid REFERENCES game_session_participants(id) ON DELETE SET NULL,
  event_type varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  state_hash text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_session_logs_session_seq
  ON game_session_logs(session_id, seq);

CREATE INDEX IF NOT EXISTS idx_game_session_logs_session
  ON game_session_logs(session_id);

CREATE TABLE IF NOT EXISTS game_session_snapshots (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  at_seq integer NOT NULL,
  snapshot jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_session_snapshots_session_seq
  ON game_session_snapshots(session_id, at_seq);

-- Seed data for heroes

INSERT INTO heroes (id, name, strength, default_spawn_amount, rarity, power1, power2, notes) VALUES
  ('troll', 'Troll', 7, 2, 'uncommon', 'fight_monster', 'change_monster', 'Combat specialist'),
  ('esprit', 'Esprit Sylvestre', 6, 2, 'uncommon', 'fight_player_with_discarded_card', 'add_strength_to_challenger', 'PvP fighter'),
  ('barde', 'Barde', 2, 1, 'rare', 'shuffle_heroes_deck', 'change_hero', 'Deck manipulation'),
  ('elf', 'Elf', 8, 2, 'uncommon', 'exchange_gems_with_player', 'exchange_2coins_for_life', 'Resource trading'),
  ('nain', 'Nain', 5, 2, 'uncommon', 'gain_2gems', 'gain_life', 'Resource generation'),
  ('mage', 'Mage', 9, 2, 'uncommon', 'see_player_card', 'remove_coin', 'Information and disruption'),
  ('exorciste', 'Exorciste', 3, 4, 'common', 'shoot_player', 'all_in', 'High risk and reward'),
  ('gobelin', 'Gobelin', 4, 2, 'uncommon', 'steal_gem', 'steal_gem', 'Gem thief'),
  ('geant', 'Geant', 10, 1, 'rare', 'keep_gems', 'parry_this_you_f_casual', 'Tank with damage'),
  ('chevalier', 'Chevalier', 11, 1, 'rare', 'teamwork', 'steal_coin', 'Elite knight'),
  ('shapeshifter', 'Shapeshifter', 1, 1, 'rare', 'mimic_hero', 'mimic_power', 'Copycat abilities'),
  ('werewolf', 'Werewolf', 0, 2, 'uncommon', 'alternate_strength', 'dual_attack', 'Alternates 5/12 strength'),
  ('witch', 'Witch', 8, 1, 'rare', 'blind_draw', 'force_transform', 'Transformation magic'),
  ('prince', 'Mad Prince', 13, 1, 'rare', 'tribute', 'execution', 'Strongest hero'),
  ('queen', 'Mad Queen', 9, 1, 'rare', 'royal_immunity', 'command_the_dead', 'Immune to attacks')
ON CONFLICT (id) DO NOTHING;

-- Seed data for monsters

INSERT INTO monsters (id, name, strength, loot_coins, loot_gems, rarity, spawn_rate) VALUES
  ('skeleton', 'Skeleton', 5, 1, 1, 'common', 49.50),
  ('goblin_warrior', 'Goblin Warrior', 5, 1, 1, 'common', 49.50),
  ('wyvern', 'Wyvern', 6, 1, 2, 'common', 49.50),
  ('minotaur', 'Minotaur', 6, 1, 2, 'common', 49.50),
  ('spectre', 'Spectre', 7, 1, 3, 'uncommon', 30.00),
  ('basilisk', 'Basilisk', 7, 1, 3, 'uncommon', 30.00),
  ('golem', 'Stone Golem', 8, 1, 3, 'uncommon', 30.00),
  ('griffon', 'Griffon', 8, 1, 4, 'uncommon', 30.00),
  ('banshee', 'Banshee', 7, 1, 4, 'uncommon', 30.00),
  ('dragon', 'Ancient Dragon', 9, 1, 5, 'rare', 15.00),
  ('chimera', 'Chimera', 9, 1, 5, 'rare', 15.00),
  ('lich', 'Lich King', 10, 1, 6, 'rare', 15.00),
  ('frost_giant', 'Frost Giant', 10, 1, 5, 'rare', 15.00),
  ('phoenix', 'Eternal Phoenix', 11, 2, 6, 'legendary', 5.00),
  ('hydra', 'Nine-Headed Hydra', 12, 2, 7, 'legendary', 5.00),
  ('kraken', 'Abyssal Kraken', 13, 2, 8, 'legendary', 5.00),
  ('leviathan', 'Primordial Leviathan', 14, 3, 10, 'legendary', 5.00),
  ('ghost_king', 'Ghost of the King', 15, 4, 15, 'mythic', 0.50)
ON CONFLICT (id) DO NOTHING;

-- Seed data for powers

INSERT INTO powers (name, cost, target_type, is_passive, trigger_event, description) VALUES
  ('change_monster', 0, 'monster', false, null, 'Swap one active monster with top card of monster deck'),
  ('fight_monster', 1, 'monster', false, null, 'Grants a free fight against a monster without normal restrictions'),
  ('fight_player_with_discarded_card', 0, 'other_player', false, null, 'Initiate strength duel using a hero from discard pile'),
  ('add_strength_to_challenger', 2, 'session', false, null, 'Add +1 strength during same-turn fight_player_with_discarded_card'),
  ('shuffle_heroes_deck', 0, 'session', false, null, 'Return all non-burned discarded heroes to deck and shuffle'),
  ('change_hero', 2, 'self', false, null, 'Draw a new hero card and discard your current one'),
  ('exchange_gems_with_player', 0, 'other_player', false, null, 'Swap your gems with those of a target player'),
  ('exchange_2coins_for_life', 0, 'self', false, null, 'Spend 2 coins to gain 1 life'),
  ('gain_2gems', 0, 'self', false, null, 'Instantly gain 2 gems'),
  ('gain_life', 6, 'self', false, null, 'Instantly gain 1 life'),
  ('see_player_card', 0, 'other_player', false, null, 'Secretly view another player''s current hero card'),
  ('remove_coin', 3, 'other_player', false, null, 'Force target player to lose 1 coin removed from game'),
  ('shoot_player', 0, 'other_player', false, null, 'Guess target''s hero; if correct, they lose 1 life'),
  ('all_in', 69, 'self', false, null, 'If last shoot_player correct: double gems; if wrong: lose all gems'),
  ('steal_gem', 0, 'other_player', false, null, 'Steal one gem from a target player'),
  ('parry_this_you_f_casual', 6, 'other_player', false, null, 'Reduce target player''s life by 1'),
  ('steal_coin', 5, 'other_player', false, null, 'Steal 1 coin from a target player'),
  ('mimic_power', 6, 'other_player', false, null, 'Copy and execute order-0 active power of target''s hero'),
  ('mimic_hero', 0, 'other_player', false, null, 'Copy another player''s hero abilities temporarily'),
  ('dual_attack', 6, 'session', false, null, 'After first monster fight, immediately fight next active monster'),
  ('blind_draw', 0, 'other_player', false, null, 'Draw a card blindly from the deck'),
  ('force_transform', 4, 'other_player', false, null, 'Force target to discard hero and draw new one'),
  ('execution', 6, 'session', false, null, 'Burn permanently remove a hero card from the game'),
  ('command_the_dead', 4, 'monster', false, null, 'Use discarded hero to fight monster and gain loot'),
  ('keep_gems', null, 'self', true, 'steal_attempt', 'Cancels steal attempts against you'),
  ('teamwork', null, 'self', true, 'gems_gained', 'When you gain gems, duplicate the amount'),
  ('alternate_strength', null, 'self', true, 'turn_start', 'Strength alternates between 5 and 12 each turn'),
  ('tribute', null, 'self', true, 'gems_gained_others', 'When another player gains gems, half are given to you instead'),
  ('royal_immunity', null, 'self', true, 'always', 'Cannot be targeted by player attacks; gets no loot from direct monster fights')
ON CONFLICT (name) DO NOTHING;

