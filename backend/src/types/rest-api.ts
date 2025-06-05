// ==================== Request/Response Interfaces ====================

export interface CreateGameRequest {
  name: string;
  hostPlayerName: string;
  teamCount?: number;
  phrasesPerPlayer?: number;
  timerDuration?: number;
}

export interface CreateGameResponse {
  gameCode: string;
  gameId: string;
  hostPlayerId: string;
  config: {
    name: string;
    teamCount: number;
    phrasesPerPlayer: number;
    timerDuration: number;
  };
}

export interface JoinGameRequest {
  playerName: string;
}

export interface JoinGameResponse {
  playerId: string;
  playerName: string;
  teamId: string | undefined;
  teamName: string | undefined;
  gameInfo: {
    id: string;
    name: string;
    status: string;
    playerCount: number;
    teamCount: number;
    phrasesPerPlayer: number;
    timerDuration: number;
  };
}

export interface GameInfoResponse {
  id: string;
  name: string;
  status: string;
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

export interface PlayerInfo {
  id: string;
  name: string;
  teamId: string | undefined;
  teamName: string | undefined;
  isConnected: boolean;
  joinedAt: string;
}

export interface PlayersResponse {
  players: PlayerInfo[];
  totalCount: number;
}

export interface UpdateConfigRequest {
  teamCount?: number;
  phrasesPerPlayer?: number;
  timerDuration?: number;
}

export interface SubmitPhrasesRequest {
  phrases: string | string[];
  playerId: string;
}

export interface SubmitPhrasesResponse {
  submittedCount: number;
  totalRequired: number;
  phrases: {
    id: string;
    text: string;
    submittedAt: string;
  }[];
}

export interface GetPhrasesResponse {
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

export interface PhraseSubmissionStatus {
  playerId: string;
  playerName: string;
  submitted: number;
  required: number;
  isComplete: boolean;
}

export interface GetPhraseStatusResponse {
  players: PhraseSubmissionStatus[];
  summary: {
    totalPlayers: number;
    playersComplete: number;
    totalPhrasesSubmitted: number;
    totalPhrasesRequired: number;
    isAllComplete: boolean;
  };
}

export interface UpdatePhraseRequest {
  text: string;
}
