import express, { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Game, Player, Team, Phrase } from '../db/schema';
import { insert, select, findById, exists, update } from '../db/utils';
import { withTransaction, TransactionConnection } from '../db/connection';

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

// ==================== Utility Functions ====================

/**
 * Generate a unique 6-character alphanumeric game code
 */
function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate game configuration parameters
 */
function validateGameConfig(config: {
  teamCount?: number;
  phrasesPerPlayer?: number;
  timerDuration?: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.teamCount !== undefined) {
    if (!Number.isInteger(config.teamCount) || config.teamCount < 2 || config.teamCount > 8) {
      errors.push('Team count must be an integer between 2 and 8');
    }
  }

  if (config.phrasesPerPlayer !== undefined) {
    if (!Number.isInteger(config.phrasesPerPlayer) || config.phrasesPerPlayer < 3 || config.phrasesPerPlayer > 10) {
      errors.push('Phrases per player must be an integer between 3 and 10');
    }
  }

  if (config.timerDuration !== undefined) {
    if (!Number.isInteger(config.timerDuration) || config.timerDuration < 30 || config.timerDuration > 180) {
      errors.push('Timer duration must be an integer between 30 and 180 seconds');
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate player name
 */
function validatePlayerName(name: string): { isValid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Player name is required' };
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 20) {
    return { isValid: false, error: 'Player name must be between 1 and 20 characters' };
  }

  // Check for valid characters (letters, numbers, spaces, basic punctuation)
  if (!/^[a-zA-Z0-9\s\-_'.]+$/.test(trimmedName)) {
    return { isValid: false, error: 'Player name contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Validate phrase text
 */
function validatePhrase(text: string): { isValid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Phrase text is required' };
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 1) {
    return { isValid: false, error: 'Phrase cannot be empty' };
  }

  if (trimmedText.length > 100) {
    return { isValid: false, error: 'Phrase must be 100 characters or less' };
  }

  // Check for reasonable characters (allow most printable characters)
  if (!/^[\w\s\-_'.,!?()]+$/.test(trimmedText)) {
    return { isValid: false, error: 'Phrase contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Validate array of phrases
 */
function validatePhrases(phrases: string[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(phrases)) {
    return { isValid: false, errors: ['Phrases must be an array'] };
  }

  if (phrases.length === 0) {
    return { isValid: false, errors: ['At least one phrase is required'] };
  }

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    if (!phrase) {
      errors.push(`Phrase ${i + 1}: Phrase is required`);
      continue;
    }
    
    const validation = validatePhrase(phrase);
    
    if (!validation.isValid) {
      errors.push(`Phrase ${i + 1}: ${validation.error}`);
      continue;
    }

    const trimmedPhrase = phrase.trim().toLowerCase();
    if (seen.has(trimmedPhrase)) {
      errors.push(`Phrase ${i + 1}: Duplicate phrase "${phrase.trim()}"`);
    } else {
      seen.add(trimmedPhrase);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Create default teams for a game
 */
async function createDefaultTeams(gameId: string, teamCount: number, transaction?: any): Promise<Team[]> {
  const teamColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
  const teamNames = ['Red Team', 'Teal Team', 'Blue Team', 'Green Team', 'Yellow Team', 'Purple Team', 'Mint Team', 'Gold Team'];

  const teams: Team[] = [];
  
  for (let i = 0; i < teamCount; i++) {
    const team: Omit<Team, 'created_at' | 'updated_at'> = {
      id: uuidv4(),
      game_id: gameId,
      name: teamNames[i] || `Team ${i + 1}`,
      color: teamColors[i] || `#${Math.floor(Math.random()*16777215).toString(16)}`,
      score_round_1: 0,
      score_round_2: 0,
      score_round_3: 0,
      total_score: 0
    };

    await insert('teams', team, transaction);
    teams.push(team as Team);
  }

  return teams;
}

/**
 * Assign player to team using round-robin
 */
async function assignPlayerToTeam(gameId: string, playerId: string, transaction?: any): Promise<string | undefined> {
  // Get all teams for the game
  const teams = await select<Team>('teams', {
    where: [{ field: 'game_id', operator: '=', value: gameId }],
    orderBy: [{ field: 'created_at', direction: 'ASC' }]
  }, transaction);

  if (teams.length === 0) {
    return undefined;
  }

  // Get current player counts for each team
  const teamPlayerCounts = new Map<string, number>();
  for (const team of teams) {
    const count = await select<Player>('players', {
      where: [
        { field: 'game_id', operator: '=', value: gameId },
        { field: 'team_id', operator: '=', value: team.id }
      ]
    }, transaction);
    teamPlayerCounts.set(team.id, count.length);
  }

  // Find team with minimum players
  let minCount = Infinity;
  let targetTeamId = teams[0]?.id;

  if (!targetTeamId) {
    return undefined;
  }

  for (const [teamId, count] of teamPlayerCounts) {
    if (count < minCount) {
      minCount = count;
      targetTeamId = teamId;
    }
  }

  return targetTeamId;
}

// ==================== Route Handlers ====================

/**
 * POST /api/games - Create a new game
 */
async function createGame(req: Request, res: Response): Promise<void> {
  try {
    const { name, hostPlayerName, teamCount = 2, phrasesPerPlayer = 5, timerDuration = 60 }: CreateGameRequest = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Game name is required' });
      return;
    }

    // Validate host player name
    const playerNameValidation = validatePlayerName(hostPlayerName);
    if (!playerNameValidation.isValid) {
      res.status(400).json({ error: playerNameValidation.error });
      return;
    }

    // Validate game configuration
    const configValidation = validateGameConfig({ teamCount, phrasesPerPlayer, timerDuration });
    if (!configValidation.isValid) {
      res.status(400).json({ error: 'Invalid game configuration', details: configValidation.errors });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) => {
      // Generate unique game code
      let gameCode: string;
      let codeExists = true;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        gameCode = generateGameCode();
        codeExists = await exists('games', [{ field: 'id', operator: '=', value: gameCode }], transaction);
        attempts++;
      } while (codeExists && attempts < maxAttempts);

      if (codeExists) {
        throw new Error('Failed to generate unique game code');
      }

      // Create host player
      const hostPlayerId = uuidv4();
      const hostPlayer: Omit<Player, 'created_at' | 'updated_at' | 'last_seen_at'> = {
        id: hostPlayerId,
        game_id: gameCode,
        name: hostPlayerName.trim(),
        team_id: null as any,
        is_connected: true
      };

      // Create game
      const game: Omit<Game, 'created_at' | 'updated_at'> = {
        id: gameCode,
        name: name.trim(),
        status: 'waiting',
        host_player_id: hostPlayerId,
        team_count: teamCount,
        phrases_per_player: phrasesPerPlayer,
        timer_duration: timerDuration,
        current_round: 1,
        current_team: 1,
        current_turn_id: null as any,
        started_at: null as any,
        finished_at: null as any
      };

      await insert('games', game, transaction);

      // Create default teams
      const teams = await createDefaultTeams(gameCode, teamCount, transaction);

      // Assign host player to first team and insert
      if (teams.length > 0 && teams[0]) {
        const updatedHostPlayer = { ...hostPlayer, team_id: teams[0].id };
        await insert('players', updatedHostPlayer, transaction);
      } else {
        await insert('players', hostPlayer, transaction);
      }

      const response: CreateGameResponse = {
        gameCode,
        gameId: gameCode,
        hostPlayerId,
        config: {
          name: name.trim(),
          teamCount,
          phrasesPerPlayer,
          timerDuration
        }
      };

      res.status(201).json(response);
    });

  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ 
      error: 'Failed to create game', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * POST /api/games/:gameCode/join - Join an existing game
 */
async function joinGame(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;
    const { playerName }: JoinGameRequest = req.body;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Validate player name
    const playerNameValidation = validatePlayerName(playerName);
    if (!playerNameValidation.isValid) {
      res.status(400).json({ error: playerNameValidation.error });
      return;
    }

    const trimmedPlayerName = playerName.trim();

    await withTransaction(async (transaction: TransactionConnection) => {
      // Check if game exists and is joinable
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'waiting') {
        res.status(400).json({ error: 'Game is no longer accepting new players' });
        return;
      }

      // Check if player name already exists in this game
      const existingPlayer = await select<Player>('players', {
        where: [
          { field: 'game_id', operator: '=', value: gameCode },
          { field: 'name', operator: '=', value: trimmedPlayerName }
        ]
      }, transaction);

      let player: Player;
      let teamInfo: { teamId?: string; teamName?: string } = {};      
      if (existingPlayer.length > 0) {
        // Player reconnecting
        player = existingPlayer[0]!;
        
        // Update connection status
        await update('players', 
          { is_connected: true, last_seen_at: new Date().toISOString() }, 
          [{ field: 'id', operator: '=', value: player.id }], 
          transaction
        );
        
        // Get team info if assigned
        if (player.team_id) {
          const team = await findById<Team>('teams', player.team_id, transaction);
          if (team) {
            teamInfo = { teamId: team.id, teamName: team.name };
          }
        }
      } else {
        // New player joining
        const playerId = uuidv4();
        
        // Assign to team first
        const assignedTeamId = await assignPlayerToTeam(gameCode, playerId, transaction);
        
        player = {
          id: playerId,
          game_id: gameCode,
          name: trimmedPlayerName,
          team_id: assignedTeamId || null as any,
          is_connected: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString()
        };

        await insert('players', player, transaction);

        if (assignedTeamId) {
          const team = await findById<Team>('teams', assignedTeamId, transaction);
          if (team) {
            teamInfo = { teamId: team.id, teamName: team.name };
          }
        }
      }

      // Get current player count
      const allPlayers = await select<Player>('players', {
        where: [{ field: 'game_id', operator: '=', value: gameCode }]
      }, transaction);

      const response: JoinGameResponse = {
        playerId: player.id,
        playerName: player.name,
        teamId: teamInfo.teamId,
        teamName: teamInfo.teamName,
        gameInfo: {
          id: game.id,
          name: game.name,
          status: game.status,
          playerCount: allPlayers.length,
          teamCount: game.team_count,
          phrasesPerPlayer: game.phrases_per_player,
          timerDuration: game.timer_duration
        }
      };

      res.status(200).json(response);
    });

  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).json({ 
      error: 'Failed to join game', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * GET /api/games/:gameCode - Get game information
 */
async function getGameInfo(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;

    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    const game = await findById<Game>('games', gameCode);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get player count
    const players = await select<Player>('players', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }]
    });

    const response: GameInfoResponse = {
      id: game.id,
      name: game.name,
      status: game.status,
      hostPlayerId: game.host_player_id,
      teamCount: game.team_count,
      phrasesPerPlayer: game.phrases_per_player,
      timerDuration: game.timer_duration,
      currentRound: game.current_round,
      currentTeam: game.current_team,
      playerCount: players.length,
      createdAt: game.created_at,
      startedAt: game.started_at
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error getting game info:', error);
    res.status(500).json({ 
      error: 'Failed to get game information', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * GET /api/games/:gameCode/players - Get list of players in game
 */
async function getGamePlayers(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;

    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Verify game exists
    const game = await findById<Game>('games', gameCode);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get players with team information
    const players = await select<Player>('players', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
      orderBy: [{ field: 'created_at', direction: 'ASC' }]
    });

    const teams = await select<Team>('teams', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }]
    });

    const teamMap = new Map(teams.map(team => [team.id, team]));

    const playerInfos: PlayerInfo[] = players.map(player => ({
      id: player.id,
      name: player.name,
      teamId: player.team_id,
      teamName: player.team_id ? teamMap.get(player.team_id)?.name : undefined,
      isConnected: player.is_connected,
      joinedAt: player.created_at
    }));

    const response: PlayersResponse = {
      players: playerInfos,
      totalCount: players.length
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error getting game players:', error);
    res.status(500).json({ 
      error: 'Failed to get game players', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * PUT /api/games/:gameCode/config - Update game configuration
 */
async function updateGameConfig(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;
    const { teamCount, phrasesPerPlayer, timerDuration }: UpdateConfigRequest = req.body;

    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Validate configuration updates
    const configToValidate: { teamCount?: number; phrasesPerPlayer?: number; timerDuration?: number } = {};
    if (teamCount !== undefined) configToValidate.teamCount = teamCount;
    if (phrasesPerPlayer !== undefined) configToValidate.phrasesPerPlayer = phrasesPerPlayer;
    if (timerDuration !== undefined) configToValidate.timerDuration = timerDuration;
    
    const configValidation = validateGameConfig(configToValidate);
    if (!configValidation.isValid) {
      res.status(400).json({ error: 'Invalid configuration', details: configValidation.errors });
      return;
    }    
    await withTransaction(async (transaction: TransactionConnection) => {
      // Check if game exists and is configurable
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game) {
        throw new Error('GAME_NOT_FOUND');
      }

      if (game.status !== 'waiting') {
        throw new Error('GAME_ALREADY_STARTED');
      }

      // Prepare update data
      const updateData: Partial<Game> = {};
      if (teamCount !== undefined) updateData.team_count = teamCount;
      if (phrasesPerPlayer !== undefined) updateData.phrases_per_player = phrasesPerPlayer;
      if (timerDuration !== undefined) updateData.timer_duration = timerDuration;      // Update game configuration
      if (Object.keys(updateData).length > 0) {
        await update('games', updateData, [{ field: 'id', operator: '=', value: gameCode }], transaction);

        // If team count changed, recreate teams
        if (teamCount !== undefined && teamCount !== game.team_count) {
          // Delete existing teams (this would cascade delete team assignments)
          // For now, we'll just recreate teams - in a real implementation
          // you might want to handle this more carefully
          
          // Create new teams
          await createDefaultTeams(gameCode, teamCount, transaction);

          // Reassign all players to teams
          const players = await select<Player>('players', {
            where: [{ field: 'game_id', operator: '=', value: gameCode }]
          }, transaction);          for (const player of players) {
            const newTeamId = await assignPlayerToTeam(gameCode, player.id, transaction);
            if (newTeamId) {
              await update('players', { team_id: newTeamId }, [{ field: 'id', operator: '=', value: player.id }], transaction);
            }
          }
        }
      }

      // Return updated game info
      const updatedGame = await findById<Game>('games', gameCode, transaction);
      const players = await select<Player>('players', {
        where: [{ field: 'game_id', operator: '=', value: gameCode }]
      }, transaction);

      const response: GameInfoResponse = {
        id: updatedGame!.id,
        name: updatedGame!.name,
        status: updatedGame!.status,
        hostPlayerId: updatedGame!.host_player_id,
        teamCount: updatedGame!.team_count,
        phrasesPerPlayer: updatedGame!.phrases_per_player,
        timerDuration: updatedGame!.timer_duration,
        currentRound: updatedGame!.current_round,
        currentTeam: updatedGame!.current_team,
        playerCount: players.length,
        createdAt: updatedGame!.created_at,
        startedAt: updatedGame!.started_at
      };

      res.status(200).json(response);
    });
  } catch (error) {
    console.error('Error updating game config:', error);
    
    if (error instanceof Error) {
      if (error.message === 'GAME_NOT_FOUND') {
        res.status(404).json({ error: 'Game not found' });
        return;
      }
      if (error.message === 'GAME_ALREADY_STARTED') {
        res.status(400).json({ error: 'Cannot update configuration after game has started' });
        return;
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to update game configuration', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * POST /api/games/:gameCode/phrases - Submit phrases for a player
 */
async function submitPhrases(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;
    const { phrases: phrasesInput, playerId }: SubmitPhrasesRequest = req.body;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Validate player ID
    if (!playerId || typeof playerId !== 'string') {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    // Normalize phrases to array
    const phrasesArray = Array.isArray(phrasesInput) ? phrasesInput : [phrasesInput];

    // Validate phrases
    const phrasesValidation = validatePhrases(phrasesArray);
    if (!phrasesValidation.isValid) {
      res.status(400).json({ error: 'Invalid phrases', details: phrasesValidation.errors });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) => {
      // Verify game exists and is in correct state
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'waiting' && game.status !== 'phrase_submission') {
        res.status(400).json({ error: 'Cannot submit phrases after game has started' });
        return;
      }

      // Verify player exists in game
      const player = await findById<Player>('players', playerId, transaction);
      if (!player || player.game_id !== gameCode) {
        res.status(400).json({ error: 'Player not found in this game' });
        return;
      }

      // Get existing phrases for this player
      const existingPhrases = await select<Phrase>('phrases', {
        where: [
          { field: 'game_id', operator: '=', value: gameCode },
          { field: 'player_id', operator: '=', value: playerId }
        ]
      }, transaction);

      // Check if adding new phrases would exceed limit
      const totalPhrasesAfterSubmission = existingPhrases.length + phrasesArray.length;
      if (totalPhrasesAfterSubmission > game.phrases_per_player) {
        res.status(400).json({
          error: `Cannot submit ${phrasesArray.length} phrases. Player can submit maximum ${game.phrases_per_player} phrases total. Currently has ${existingPhrases.length} phrases.`
        });
        return;
      }      // Check for duplicates within the game
      const allGamePhrases = await select<Phrase>('phrases', {
        where: [{ field: 'game_id', operator: '=', value: gameCode }]
      }, transaction);

      const existingPhrasesLower = new Set(
        allGamePhrases
          .filter(p => p.text && typeof p.text === 'string')
          .map(p => p.text.toLowerCase())
      );
      const duplicates: string[] = [];

      for (const phrase of phrasesArray) {
        if (existingPhrasesLower.has(phrase.trim().toLowerCase())) {
          duplicates.push(phrase.trim());
        }
      }

      if (duplicates.length > 0) {
        res.status(400).json({
          error: 'Duplicate phrases detected',
          details: [`The following phrases already exist in this game: ${duplicates.join(', ')}`]
        });
        return;
      }

      // Insert new phrases
      const submittedPhrases: { id: string; text: string; submittedAt: string }[] = [];
      const now = new Date().toISOString();

      for (const phraseText of phrasesArray) {
        const phraseId = uuidv4();
        const phrase: Omit<Phrase, 'created_at' | 'updated_at'> = {
          id: phraseId,
          game_id: gameCode,
          player_id: playerId,
          text: phraseText.trim(),
          status: 'active'
        };

        await insert('phrases', phrase, transaction);
        submittedPhrases.push({
          id: phraseId,
          text: phraseText.trim(),
          submittedAt: now
        });
      }      // Update game status if this was first phrase submission
      if (game.status === 'waiting') {
        await update('games', { status: 'phrase_submission' }, [{ field: 'id', operator: '=', value: gameCode }], transaction);
      }

      const response: SubmitPhrasesResponse = {
        submittedCount: phrasesArray.length,
        totalRequired: game.phrases_per_player,
        phrases: submittedPhrases
      };

      res.status(201).json(response);
    });

  } catch (error) {
    console.error('Error submitting phrases:', error);
    res.status(500).json({
      error: 'Failed to submit phrases',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/games/:gameCode/phrases - Get phrases for the game (admin/host only)
 */
async function getGamePhrases(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;
    const { playerId } = req.query;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Verify game exists
    const game = await findById<Game>('games', gameCode);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Verify authorization - only host can view all phrases
    if (playerId && typeof playerId === 'string') {
      const player = await findById<Player>('players', playerId);
      if (!player || player.game_id !== gameCode) {
        res.status(403).json({ error: 'Player not found in this game' });
        return;
      }

      if (player.id !== game.host_player_id) {
        res.status(403).json({ error: 'Only the game host can view all phrases' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Player ID is required for authorization' });
      return;
    }

    // Get all phrases for the game
    const phrases = await select<Phrase>('phrases', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
      orderBy: [{ field: 'created_at', direction: 'ASC' }]
    });

    // Get all players to map player names
    const players = await select<Player>('players', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }]
    });

    const playerMap = new Map(players.map(p => [p.id, p.name]));

    const phrasesWithPlayer = phrases.map(phrase => ({
      id: phrase.id,
      text: phrase.text,
      playerId: phrase.player_id,
      playerName: playerMap.get(phrase.player_id) || 'Unknown Player',
      submittedAt: phrase.created_at
    }));

    const response: GetPhrasesResponse = {
      phrases: phrasesWithPlayer,
      totalCount: phrases.length,
      gameInfo: {
        phrasesPerPlayer: game.phrases_per_player,
        totalPlayers: players.length,
        totalExpected: players.length * game.phrases_per_player
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error getting game phrases:', error);
    res.status(500).json({
      error: 'Failed to get game phrases',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/games/:gameCode/phrases/status - Get phrase submission status for all players
 */
async function getPhraseSubmissionStatus(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode } = req.params;

    // Validate game code
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    // Verify game exists
    const game = await findById<Game>('games', gameCode);
    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    // Get all players in the game
    const players = await select<Player>('players', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }],
      orderBy: [{ field: 'created_at', direction: 'ASC' }]
    });

    // Get all phrases for the game
    const phrases = await select<Phrase>('phrases', {
      where: [{ field: 'game_id', operator: '=', value: gameCode }]
    });

    // Count phrases per player
    const phraseCountMap = new Map<string, number>();
    for (const phrase of phrases) {
      phraseCountMap.set(phrase.player_id, (phraseCountMap.get(phrase.player_id) || 0) + 1);
    }

    // Build status for each player
    const playerStatuses: PhraseSubmissionStatus[] = players.map(player => {
      const submitted = phraseCountMap.get(player.id) || 0;
      return {
        playerId: player.id,
        playerName: player.name,
        submitted,
        required: game.phrases_per_player,
        isComplete: submitted >= game.phrases_per_player
      };
    });

    const playersComplete = playerStatuses.filter(p => p.isComplete).length;
    const totalPhrasesSubmitted = phrases.length;
    const totalPhrasesRequired = players.length * game.phrases_per_player;

    const response: GetPhraseStatusResponse = {
      players: playerStatuses,
      summary: {
        totalPlayers: players.length,
        playersComplete,
        totalPhrasesSubmitted,
        totalPhrasesRequired,
        isAllComplete: playersComplete === players.length && players.length > 0
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error getting phrase submission status:', error);
    res.status(500).json({
      error: 'Failed to get phrase submission status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * PUT /api/games/:gameCode/phrases/:phraseId - Edit a specific phrase
 */
async function updatePhrase(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode, phraseId } = req.params;
    const { text }: UpdatePhraseRequest = req.body;
    const { playerId } = req.query;

    // Validate parameters
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    if (!phraseId || typeof phraseId !== 'string') {
      res.status(400).json({ error: 'Invalid phrase ID' });
      return;
    }

    if (!playerId || typeof playerId !== 'string') {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    // Validate new phrase text
    const phraseValidation = validatePhrase(text);
    if (!phraseValidation.isValid) {
      res.status(400).json({ error: phraseValidation.error });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) => {
      // Verify game exists and is in correct state
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'waiting' && game.status !== 'phrase_submission') {
        res.status(400).json({ error: 'Cannot edit phrases after game has started' });
        return;
      }

      // Verify phrase exists and belongs to the player
      const phrase = await findById<Phrase>('phrases', phraseId, transaction);
      if (!phrase) {
        res.status(404).json({ error: 'Phrase not found' });
        return;
      }

      if (phrase.game_id !== gameCode) {
        res.status(400).json({ error: 'Phrase does not belong to this game' });
        return;
      }

      if (phrase.player_id !== playerId) {
        res.status(403).json({ error: 'You can only edit your own phrases' });
        return;
      }

      // Check for duplicates (excluding current phrase)
      const existingPhrases = await select<Phrase>('phrases', {
        where: [
          { field: 'game_id', operator: '=', value: gameCode },
          { field: 'id', operator: '!=', value: phraseId }
        ]      }, transaction);

      const existingTexts = new Set(existingPhrases.map(p => p.text?.toLowerCase()).filter(Boolean));
      if (existingTexts.has(text.trim().toLowerCase())) {
        res.status(400).json({ error: 'This phrase already exists in the game' });
        return;
      }      // Update the phrase
      const updatedAt = new Date().toISOString();
      await update('phrases', 
        { text: text.trim(), updated_at: updatedAt }, 
        [{ field: 'id', operator: '=', value: phraseId }], 
        transaction
      );

      res.status(200).json({
        id: phraseId,
        text: text.trim(),
        updatedAt: updatedAt
      });
    });

  } catch (error) {
    console.error('Error updating phrase:', error);
    res.status(500).json({
      error: 'Failed to update phrase',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * DELETE /api/games/:gameCode/phrases/:phraseId - Delete a specific phrase
 */
async function deletePhrase(req: Request, res: Response): Promise<void> {
  try {
    const { gameCode, phraseId } = req.params;
    const { playerId } = req.query;

    // Validate parameters
    if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 6) {
      res.status(400).json({ error: 'Invalid game code' });
      return;
    }

    if (!phraseId || typeof phraseId !== 'string') {
      res.status(400).json({ error: 'Invalid phrase ID' });
      return;
    }

    if (!playerId || typeof playerId !== 'string') {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    await withTransaction(async (transaction: TransactionConnection) => {
      // Verify game exists and is in correct state
      const game = await findById<Game>('games', gameCode, transaction);
      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      if (game.status !== 'waiting' && game.status !== 'phrase_submission') {
        res.status(400).json({ error: 'Cannot delete phrases after game has started' });
        return;
      }

      // Verify phrase exists
      const phrase = await findById<Phrase>('phrases', phraseId, transaction);
      if (!phrase) {
        res.status(404).json({ error: 'Phrase not found' });
        return;
      }

      if (phrase.game_id !== gameCode) {
        res.status(400).json({ error: 'Phrase does not belong to this game' });
        return;
      }

      // Verify authorization (player owns phrase OR player is host)
      const player = await findById<Player>('players', playerId, transaction);
      if (!player || player.game_id !== gameCode) {
        res.status(403).json({ error: 'Player not found in this game' });
        return;
      }

      const canDelete = phrase.player_id === playerId || player.id === game.host_player_id;
      if (!canDelete) {
        res.status(403).json({ error: 'You can only delete your own phrases, or phrases as the game host' });
        return;
      }

      // Delete the phrase (assuming we have a delete utility function)
      // For now, we'll mark it as deleted by updating status or removing from active phrases
      // Since we don't have a delete function in utils, we'll need to implement this differently
      // For SQLite, we can use direct SQL deletion
      
      // This is a workaround - in a real implementation, you'd add a delete utility
      await transaction.run('DELETE FROM phrases WHERE id = ?', [phraseId]);

      res.status(200).json({ message: 'Phrase deleted successfully' });
    });

  } catch (error) {
    console.error('Error deleting phrase:', error);
    res.status(500).json({
      error: 'Failed to delete phrase',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ==================== Router Setup ====================

const router: Router = express.Router();

// Game management routes
router.post('/games', createGame);
router.post('/games/:gameCode/join', joinGame);
router.get('/games/:gameCode', getGameInfo);
router.get('/games/:gameCode/players', getGamePlayers);
router.put('/games/:gameCode/config', updateGameConfig);

// Phrase management routes
router.post('/games/:gameCode/phrases', submitPhrases);
router.get('/games/:gameCode/phrases', getGamePhrases);
router.get('/games/:gameCode/phrases/status', getPhraseSubmissionStatus);
router.put('/games/:gameCode/phrases/:phraseId', updatePhrase);
router.delete('/games/:gameCode/phrases/:phraseId', deletePhrase);

export default router;
export {
  createGame,
  joinGame,
  getGameInfo,
  getGamePlayers,
  updateGameConfig,
  submitPhrases,
  getGamePhrases,
  getPhraseSubmissionStatus,
  updatePhrase,
  deletePhrase
};