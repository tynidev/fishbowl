/**
 * Team management utilities for the Fishbowl game
 */

import { v4 as uuidv4 } from 'uuid';
import { Team, Player } from '../db/schema';
import { insert, select } from '../db/utils';

/**
 * Create default teams for a game
 */
export async function createDefaultTeams(
  gameId: string,
  teamCount: number,
  transaction?: any
): Promise<Team[]> {
  const teamColors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
  ];
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

  const teams: Team[] = [];

  for (let i = 0; i < teamCount; i++) {
    const team: Omit<Team, 'created_at' | 'updated_at'> = {
      id: uuidv4(),
      game_id: gameId,
      name: teamNames[i] || `Team ${i + 1}`,
      color:
        teamColors[i] ||
        `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      score_round_1: 0,
      score_round_2: 0,
      score_round_3: 0,
      total_score: 0,
    };

    await insert('teams', team, transaction);
    teams.push(team as Team);
  }

  return teams;
}

/**
 * Assign player to team using round-robin
 */
export async function assignPlayerToTeam(
  gameId: string,
  transaction?: any
): Promise<string | undefined> {
  // Get all teams for the game
  const teams = await select<Team>(
    'teams',
    {
      where: [{ field: 'game_id', operator: '=', value: gameId }],
      orderBy: [{ field: 'created_at', direction: 'ASC' }],
    },
    transaction
  );

  if (teams.length === 0) {
    return undefined;
  }

  // Get current player counts for each team
  const teamPlayerCounts = new Map<string, number>();
  for (const team of teams) {
    const count = await select<Player>(
      'players',
      {
        where: [
          { field: 'game_id', operator: '=', value: gameId },
          { field: 'team_id', operator: '=', value: team.id },
        ],
      },
      transaction
    );
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
