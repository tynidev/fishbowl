/**
 * Team management utilities for the Fishbowl game
 */

import { v4 as uuidv4 } from 'uuid';
import { Team, Player } from '../db/schema';
import { insert, select } from '../db/utils';

/**
 * Creates default teams for a Fishbowl game with randomly assigned colors and names.
 * 
 * This function generates teams with unique visual identity by randomly selecting
 * from predefined color schemes and names. Each team gets a unique color/name
 * combination with no duplicates. If more teams are requested than predefined
 * options available, it falls back to generic names and random colors.
 * 
 * @param gameId - The unique identifier of the game to create teams for
 * @param teamCount - The number of teams to create (must be positive integer)
 * @param transaction - Optional database transaction for atomic operations
 * 
 * @returns Promise that resolves to an array of created Team objects
 * 
 * @throws Will throw an error if database insertion fails
 * 
 * @example
 * ```typescript
 * // Create 4 teams for a game (random selection each time)
 * const teams = await createDefaultTeams('game-123', 4);
 * // Returns: [Purple Team, Blue Team, Gold Team, Red Team] (random order)
 * 
 * // Create more teams than predefined (falls back to generic names)
 * const manyTeams = await createDefaultTeams('game-456', 10);
 * // Returns: [...8 random predefined teams..., Team 9, Team 10]
 * ```
 */
export async function createDefaultTeams(
  gameId: string,
  teamCount: number,
  transaction?: any
): Promise<Team[]> {
  // Predefined color palette for teams (hex color codes)
  // Colors chosen for good contrast and visual distinction
  const teamColors = [
    '#FF6B6B', // Coral Red
    '#4ECDC4', // Turquoise
    '#45B7D1', // Sky Blue
    '#96CEB4', // Mint Green
    '#FFEAA7', // Pastel Yellow
    '#DDA0DD', // Plum Purple
    '#98D8C8', // Seafoam Green
    '#F7DC6F', // Golden Yellow
  ];

  // Corresponding team names that match the color scheme
  const teamNames = [
    'Red Team',
    'Teal Team',
    'Blue Team',
    'Green Team',
    'Yellow Team',
    'Purple Team',
    'Mint Team',
    'Gold Team',
  ];

  // Create shuffled copies to pick from randomly without duplicates
  const availableColors = [...teamColors];
  const availableNames = [...teamNames];
    // Fisher-Yates shuffle algorithm for random order
  const shuffleArray = <T>(array: T[]): void => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
  };

  // Shuffle both arrays to ensure random selection
  shuffleArray(availableColors);
  shuffleArray(availableNames);

  const teams: Team[] = [];
  // Create teams up to the requested count
  for (let i = 0; i < teamCount; i++) {
    // Create team object with all required fields
    const team: Omit<Team, 'created_at' | 'updated_at'> = {
      id: uuidv4(), // Generate unique identifier
      game_id: gameId,
      // Use shuffled predefined name or fallback to generic "Team N"
      name: availableNames[i] || `Team ${i + 1}`,
      // Use shuffled predefined color or generate random hex color
      color:
        availableColors[i] ||
        `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
      // Initialize all round scores to 0
      score_round_1: 0,
      score_round_2: 0,
      score_round_3: 0,
      total_score: 0,
    };

    // Insert team into database
    await insert('teams', team, transaction);
    // Add to return array (cast to include timestamp fields)
    teams.push(team as Team);
  }

  return teams;
}

/**
 * Assigns a player to a team using a balanced distribution algorithm.
 * 
 * This function implements a "fewest players first" strategy to ensure teams
 * remain balanced throughout the player joining process. It finds the team
 * with the minimum number of players and returns its ID for assignment.
 * 
 * @param gameId - The unique identifier of the game
 * @param transaction - Optional database transaction for atomic operations
 * 
 * @returns Promise that resolves to the team ID where the player should be assigned,
 *          or undefined if no teams exist for the game
 * 
 * @throws Will throw an error if the game does not exist or database operations fail
 * 
 * @example
 * ```typescript
 * // Assign a new player to the team with fewest members
 * const teamId = await assignPlayerToTeam('game-123');
 * if (teamId) {
 *   await assignPlayer(playerId, teamId);
 * }
 * 
 * // Use within a transaction
 * const teamId = await assignPlayerToTeam('game-123', trx);
 * ```
 */
export async function assignPlayerToTeam(
  gameId: string,
  transaction?: any
): Promise<string | undefined> {
  const operation = async (conn: any) => {
    // First validate that the game exists
    const gameExists = await conn.get(
      'SELECT 1 FROM games WHERE id = ? LIMIT 1',
      [gameId]
    );

    if (!gameExists) {
      throw new Error(`Game with ID ${gameId} does not exist`);
    }

    // Get teams with their current player counts using a single optimized query
    const teamsWithCounts = await conn.all(`
      SELECT 
        t.id,
        t.created_at,
        COALESCE(COUNT(p.id), 0) as player_count
      FROM teams t
      LEFT JOIN players p ON t.id = p.team_id AND p.game_id = ?
      WHERE t.game_id = ?
      GROUP BY t.id, t.created_at
      ORDER BY t.created_at ASC
    `, [gameId, gameId]);

    if (teamsWithCounts.length === 0) {
      return undefined;
    }

    // Find team with minimum players (first in creation order if tied)
    let minCount = Infinity;
    let targetTeamId = teamsWithCounts[0]?.id;

    for (const team of teamsWithCounts) {
      if (team.player_count < minCount) {
        minCount = team.player_count;
        targetTeamId = team.id;
      }
    }

    return targetTeamId;
  };

  if (transaction) {
    return await operation(transaction);
  } else {
    // Import withConnection locally to avoid circular dependency
    const { withConnection } = await import('../db/connection');
    return await withConnection(operation);
  }
}
