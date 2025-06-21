// ==================== Request/Response Interfaces ====================

export interface CreateGameRequest
{
  name: string;
  hostPlayerName: string;
  teamCount?: number;
  phrasesPerPlayer?: number;
  timerDuration?: number;
}

export interface JoinGameRequest
{
  playerName: string;
  teamId?: string;
}

export interface JoinGameResponse
{
  playerId: string;
  playerName: string;
  teamId: string | undefined;
  teamName: string | undefined;
  gameInfo: {
    id: string;
    name: string;
    status: 'setup' | 'playing' | 'finished';
    sub_status: // When status = 'setup'
      | 'waiting_for_players' // Players joining, getting assigned to teams, submitting phrases
      | 'ready_to_start' // All players joined, all phrases submitted, host can start
      // When status = 'playing'
      | 'round_intro' // Showing round rules before starting
      | 'turn_starting' // Brief moment between turns (showing whose turn)
      | 'turn_active' // Active turn with timer running
      | 'turn_paused' // Turn paused (disconnection, dispute, etc.)
      | 'round_complete' // Round finished, showing scores before next round
      // When status = 'finished'
      | 'game_complete'; // Final scores, game over
    playerCount: number;
    teamCount: number;
    phrasesPerPlayer: number;
    timerDuration: number;
  };
}

export interface GameInfoResponse
{
  id: string;
  name: string;
  status: 'setup' | 'playing' | 'finished';
  sub_status: // When status = 'setup'
    | 'waiting_for_players' // Players joining, getting assigned to teams, submitting phrases
    | 'ready_to_start' // All players joined, all phrases submitted, host can start
    // When status = 'playing'
    | 'round_intro' // Showing round rules before starting
    | 'turn_starting' // Brief moment between turns (showing whose turn)
    | 'turn_active' // Active turn with timer running
    | 'turn_paused' // Turn paused (disconnection, dispute, etc.)
    | 'round_complete' // Round finished, showing scores before next round
    // When status = 'finished'
    | 'game_complete'; // Final scores, game over
  hostPlayerId: string;
  teamCount: number;
  phrasesPerPlayer: number;
  timerDuration: number;
  currentRound: number;
  currentTeam: number;
  playerCount: number;
  createdAt: string;
  startedAt: string | undefined;
}

export interface PlayerInfo
{
  id: string;
  name: string;
  teamId: string | undefined;
  teamName: string | undefined;
  isConnected: boolean;
  joinedAt: string;
}

export interface PlayersResponse
{
  players: PlayerInfo[];
  totalCount: number;
}

export interface UpdateConfigRequest
{
  teamCount?: number;
  phrasesPerPlayer?: number;
  timerDuration?: number;
}

export interface SubmitPhrasesRequest
{
  phrases: string | string[];
  playerId: string;
}

export interface SubmitOrUpdatePhraseResponse
{
  submittedCount: number;
  totalRequired: number;
  phrases: {
    id: string;
    text: string;
    submittedAt: string;
  }[];
}

export interface GetPhrasesResponse
{
  phrases: {
    id: string;
    text: string;
    playerId: string;
    playerName: string;
    submittedAt: string;
  }[];
  totalCount: number;
  gameInfo: {
    phrasesPerPlayer: number;
    totalPlayers: number;
    totalExpected: number;
  };
}

export interface PhraseSubmissionStatus
{
  playerId: string;
  playerName: string;
  submitted: number;
  required: number;
  isComplete: boolean;
}

export interface GetPhraseStatusResponse
{
  players: PhraseSubmissionStatus[];
  summary: {
    totalPlayers: number;
    playersComplete: number;
    totalPhrasesSubmitted: number;
    totalPhrasesRequired: number;
    isAllComplete: boolean;
  };
}

export interface UpdatePhraseRequest
{
  text: string;
}

// ==================== Device Session Interfaces ====================

export interface DeviceSessionResponse
{
  id: string;
  deviceId: string;
  socketId: string | null;
  lastSeen: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerInfoResponse
{
  id: string;
  name: string;
  gameId: string;
  teamId: string | null;
  isConnected: boolean;
}

export interface DeviceSessionGameInfoResponse
{
  id: string;
  name: string;
  status: 'setup' | 'playing' | 'finished';
  sub_status: // When status = 'setup'
    | 'waiting_for_players' // Players joining, getting assigned to teams, submitting phrases
    | 'ready_to_start' // All players joined, all phrases submitted, host can start
    // When status = 'playing'
    | 'round_intro' // Showing round rules before starting
    | 'turn_starting' // Brief moment between turns (showing whose turn)
    | 'turn_active' // Active turn with timer running
    | 'turn_paused' // Turn paused (disconnection, dispute, etc.)
    | 'round_complete' // Round finished, showing scores before next round
    // When status = 'finished'
    | 'game_complete'; // Final scores, game over
  hostPlayerId: string;
}

export interface GetDeviceSessionResponse
{
  success: boolean;
  session: DeviceSessionResponse;
  player: PlayerInfoResponse | null;
  game: DeviceSessionGameInfoResponse | null;
}

export interface GenerateDeviceIdResponse
{
  success: boolean;
  deviceId: string;
}

export interface CheckActiveSessionResponse
{
  success: boolean;
  hasActiveSession: boolean;
}

export interface ActiveSessionInfo
{
  id: string;
  deviceId: string;
  socketId: string | null;
  lastSeen: string;
  isActive: boolean;
  player: PlayerInfoResponse | null;
}

export interface GetActiveSessionsResponse
{
  success: boolean;
  gameId: string;
  activeSessions: ActiveSessionInfo[];
  count: number;
}

export interface DeactivateSessionRequest
{
  gameId?: string;
}

export interface DeactivateSessionResponse
{
  success: boolean;
  message: string;
}

export interface CleanupSessionsResponse
{
  success: boolean;
  message: string;
  staleSessionsDeactivated: number;
  oldSessionsRemoved: number;
}

export interface StartRoundResponse
{
  round: number;
  roundName: string;
  currentTurnId: string;
  currentPlayer: {
    id: string;
    teamId: string;
  };
  startedAt: string;
}
