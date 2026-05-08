import { getJson, postJson } from "./client";

export interface Lobby {
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

export interface RoomDescriptor {
  name: string;
  sessionId: string;
}

interface LobbiesResponse {
  lobbies: Lobby[];
}

interface LobbyActionResponse {
  lobby: Lobby;
  room: RoomDescriptor;
}

export interface CreateLobbyRequest {
  maxPlayers: number;
  botCount: number;
  burnedHeroesCount: number;
}

export interface JoinLobbyRequest {
  displayName: string;
}

export function listLobbies(): Promise<LobbiesResponse> {
  return getJson<LobbiesResponse>("/lobbies");
}

export function createLobby(payload: CreateLobbyRequest): Promise<LobbyActionResponse> {
  return postJson<LobbyActionResponse, CreateLobbyRequest>("/lobbies", payload);
}

export function joinLobby(lobbyId: string, payload: JoinLobbyRequest): Promise<LobbyActionResponse> {
  return postJson<LobbyActionResponse, JoinLobbyRequest>(`/lobbies/${lobbyId}/join`, payload);
}
