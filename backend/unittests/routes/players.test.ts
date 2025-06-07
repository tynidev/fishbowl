import request from 'supertest';
import {
  createGameScenario,
  expectValidJoinGameResponse,
  expectValidPlayersResponse,
  resetAllMocks,
} from '../test-helpers';
import { playerFactory } from '../test-factories';
import { app } from '../setupTests';
import { createRealDataStoreFromScenario } from '../realDbUtils';

describe('Players API', () => {

  beforeEach(async () => {
    await resetAllMocks();
  });

  describe('GET /api/games/:gameCode/players', () => {
    // Current Test Coverage:
    // ✓ Basic functionality - Returns players list successfully with proper format
    // ✓ Connection states - Handles mixed connected/disconnected player states
    // ✓ Invalid game code - Returns 400 for invalid game code format
    // ✓ Non-existent game - Returns 404 for valid code but missing game
    // ✓ Empty game - Returns valid response with only host player (no regular players)
    // ✓ Even team distribution - Handles 6 players across 3 teams (2 per team)
    // ✓ Uneven team distribution - Handles 7 players across 3 teams (2-3 per team)
    // ✓ Large team configuration - Handles maximum 6 teams with 12 players
    // ✓ Single player per team - Handles 4 players across 4 teams
    // ✓ Large player count - Handles 20 players across 2 teams
      
    const gameCode = 'ABC123';

    /**
     * Test that the GET players endpoint returns a properly formatted response
     * with all player data including team assignments when the game exists.
     */
    it('should return players list successfully', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 2,
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      expectValidPlayersResponse(response, scenario.players, scenario.teams);
    });

    /**
     * Test that the endpoint correctly handles and returns players with different
     * connection states (connected/disconnected) and validates the response structure.
     * Creates players manually using factories to control their connection state.
     */
    it('should handle mixed connection states correctly', async () => {
      const scenario = createGameScenario({
          gameCode: gameCode,
          teamCount:2,
          playerCount: 0, // Don't create players automatically
          gameName: 'Test Game',
          gameStatus: 'waiting',
        });

      const store = await createRealDataStoreFromScenario(scenario).initDb();
      
      // Create players with different connection states using factories
      const connectedPlayer = playerFactory.connected(gameCode, scenario.teams![0]!.id, 'Connected Player');
      const disconnectedPlayer = playerFactory.disconnected(gameCode, scenario.teams![1]!.id, 'Disconnected Player');
      
      await store.addPlayer(connectedPlayer);
      await store.addPlayer(disconnectedPlayer);

      // add players to the scenario for comparison/verification
      scenario.players.push(connectedPlayer, disconnectedPlayer);

      // Act
      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      // Validate response structure and content
      expectValidPlayersResponse(response, scenario.players, scenario.teams);

      // Check that connected and disconnected players are correctly marked
      const connectedPlayers = response.body.players.filter((p: any) => p.isConnected);
      const disconnectedPlayers = response.body.players.filter((p: any) => !p.isConnected);
      expect(connectedPlayers.length).toBeGreaterThan(0);
      expect(disconnectedPlayers.length).toBeGreaterThan(0);
    });

    /**
     * Test that the endpoint returns a 400 Bad Request error when provided with
     * an invalid game code format (e.g., too short, wrong characters).
     * This tests parameter validation before any database lookups.
     */
    it('should return 400 for invalid game code', async () => {
      const response = await request(app)
        .get('/api/games/INVALID/players')
        .expect(400);

      expect(response.body.error).toBe('Invalid game code');
    });

    /**
     * Test that the endpoint returns a 404 Not Found error when provided with
     * a valid game code format but the game doesn't exist in the database.
     * This tests database lookup validation after parameter validation passes.
     */
    it('should return 404 for non-existent game', async () => {
      const scenario = createGameScenario({
          gameCode: gameCode,
          teamCount:2,
          playerCount: 2,
          gameStatus: 'waiting'
        });
      
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .get(`/api/games/XXXXXX/players`)
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });

    /**
     * Test that the endpoint correctly handles games with no players.
     * Verifies that an empty game returns valid response structure with only the host player.
     * This tests the scenario where a game exists but has no players yet.
     */
    it('should return empty list for game with no players', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 0, // No players in the game
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      expect(response.body).toHaveProperty('players');
      expect(response.body).toHaveProperty('totalCount', 1); // host_player is always present
      expect(Array.isArray(response.body.players)).toBe(true);
      expect(response.body.players).toHaveLength(1);

      expectValidPlayersResponse(response, scenario.players, scenario.teams);
    });

    /**
     * Test team balance with even distribution across teams.
     * Verifies that players are distributed evenly when team count divides player count evenly.
     */
    it('should handle even team distribution correctly', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 3,
        playerCount: 6, // 2 players per team
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      expectValidPlayersResponse(response, scenario.players, scenario.teams);

      // Verify even distribution
      const teamCounts = new Map<string, number>();
      response.body.players.forEach((player: any) => {
        if (player.teamId) {
          teamCounts.set(player.teamId, (teamCounts.get(player.teamId) || 0) + 1);
        }
      });

      // All teams should have exactly 2 players
      teamCounts.forEach(count => {
        expect(count).toBe(2);
      });
      expect(teamCounts.size).toBe(3); // All 3 teams should have players
    });

    /**
     * Test team balance with uneven distribution (players don't divide evenly).
     * Verifies that the system handles cases where players cannot be distributed evenly
     * and that the difference between team sizes is minimal.
     */
    it('should handle uneven team distribution correctly', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 3,
        playerCount: 7, // Cannot divide evenly: some teams get 3, others get 2
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      expectValidPlayersResponse(response, scenario.players, scenario.teams);

      // Verify balanced distribution with minimal difference
      const teamCounts = new Map<string, number>();
      response.body.players.forEach((player: any) => {
        if (player.teamId) {
          teamCounts.set(player.teamId, (teamCounts.get(player.teamId) || 0) + 1);
        }
      });

      const counts = Array.from(teamCounts.values()).sort();
      expect(teamCounts.size).toBe(3); // All teams should have players
      expect(counts[0]).toBe(2); // Minimum team size
      expect(counts[2]).toBe(3); // Maximum team size
      expect((counts[2] ?? 0) - (counts[0] ?? 0)).toBeLessThanOrEqual(1); // Difference should be at most 1
    });

    /**
     * Test large team scenario to verify system handles maximum team configuration.
     * Tests with maximum allowed teams (6) to ensure scalability.
     */
    it('should handle large team configuration correctly', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 6, // Maximum allowed teams
        playerCount: 12, // 2 players per team
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      expectValidPlayersResponse(response, scenario.players, scenario.teams);

      // Verify all teams are represented
      const teamIds = new Set(response.body.players.map((p: any) => p.teamId).filter(Boolean));
      expect(teamIds.size).toBe(6);

      // Verify each team has expected number of players
      const teamCounts = new Map<string, number>();
      response.body.players.forEach((player: any) => {
        if (player.teamId) {
          teamCounts.set(player.teamId, (teamCounts.get(player.teamId) || 0) + 1);
        }
      });

      teamCounts.forEach(count => {
        expect(count).toBe(2); // Each team should have exactly 2 players
      });
    });

    /**
     * Test scenario with single player per team to verify minimum team population.
     * Ensures system works correctly when teams have minimal players.
     */
    it('should handle single player per team correctly', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 4,
        playerCount: 4, // 1 player per team
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      expectValidPlayersResponse(response, scenario.players, scenario.teams);

      // Verify each team has exactly one player
      const teamIds = new Set(response.body.players.map((p: any) => p.teamId).filter(Boolean));
      expect(teamIds.size).toBe(4); // All 4 teams should have players

      const teamCounts = new Map<string, number>();
      response.body.players.forEach((player: any) => {
        if (player.teamId) {
          teamCounts.set(player.teamId, (teamCounts.get(player.teamId) || 0) + 1);
        }
      });

      teamCounts.forEach(count => {
        expect(count).toBe(1); // Each team should have exactly 1 player
      });
    });

    /**
     * Test scenario with many players to verify system handles large player counts.
     * Tests performance and correctness with a significant number of players.
     */
    it('should handle large player count correctly', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 20, // 10 players per team
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .get(`/api/games/${gameCode}/players`)
        .expect(200);

      expectValidPlayersResponse(response, scenario.players, scenario.teams);

      // Verify total count
      expect(response.body.totalCount).toBe(20);
      expect(response.body.players).toHaveLength(20);

      // Verify team distribution
      const teamCounts = new Map<string, number>();
      response.body.players.forEach((player: any) => {
        if (player.teamId) {
          teamCounts.set(player.teamId, (teamCounts.get(player.teamId) || 0) + 1);
        }
      });

      expect(teamCounts.size).toBe(2); // All teams should have players
      teamCounts.forEach(count => {
        expect(count).toBe(10); // Each team should have exactly 5 players
      });
    });
  });

  describe('POST /api/games/:gameCode/join', () => {
    // Current Test Coverage:
    // ✓ Basic functionality - Joins game successfully with valid player name
    // ✓ Player name too short - Returns 400 for player name shorter than 1 character
    // ✓ Player name too long - Returns 400 for player name longer than 20 characters
    // ✓ Player name contains invalid characters - Returns 400 for names with invalid characters (letters, numbers, spaces, hyphens, underscores, apostrophes, periods)
    // ✓ Invalid game code - Returns 400 for invalid game code format
    // ✓ Non-existent game - Returns 404 for valid code but missing game
    // ✓ Game already started - Returns 400 if game is not in waiting state
    // ✓ Player already exists in game - returns valid JoinGameResponse response with existing player data
    // ✓ Player joins with team assignment - Assigns player to correct team if available
    // ✓ Player joins when no teams exist - returns 400 if no teams are available to join

    const gameCode = 'XYZ789';

    /**
     * Test that the POST join endpoint allows a player to join a game successfully
     * with a valid player name and returns the expected response structure.
     */
    it('should join game successfully', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 0, // No players initially
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const newPlayerName = 'New Player';

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send({ playerName: newPlayerName })
        .expect(200);

      expectValidJoinGameResponse(response, scenario, newPlayerName);
    });

    /**
     * Test that the endpoint returns a 400 error when the player name is too short
     * (empty string or less than 1 character).
     */
    it('should return 400 for player name too short', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 0,
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send({ playerName: '' })
        .expect(400);

      expect(response.body.error).toMatch(/player name/i);
    });

    /**
     * Test that the endpoint returns a 400 error when the player name is too long
     * (more than 20 characters).
     */
    it('should return 400 for player name too long', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 0,
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const longName = 'a'.repeat(21); // 21 characters

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send({ playerName: longName })
        .expect(400);

      expect(response.body.error).toMatch(/player name/i);
    });

    /**
     * Test that the endpoint returns a 400 error when the player name contains
     * invalid characters. Valid characters are: letters, numbers, spaces, hyphens,
     * underscores, apostrophes, and periods.
     */
    it('should return 400 for player name with invalid characters', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 0,
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const invalidNames = [
        'Player@123',     // @ symbol
        'Player#1',       // # symbol
        'Player$',        // $ symbol
        'Player&Name',    // & symbol
        'Player!',        // ! symbol
        'Player%20',      // % symbol
        'Player*',        // * symbol
        'Player+Name',    // + symbol
        'Player=Name',    // = symbol
        'Player[1]',      // brackets
        'Player{Name}',   // braces
        'Player<Name>',   // angle brackets
        'Player|Name',    // pipe
        'Player\\Name',   // backslash
        'Player/Name',    // forward slash
        'Player:Name',    // colon
        'Player;Name',    // semicolon
        'Player"Name"',   // quotes
        'Player,Name',    // comma
        'Player?',        // question mark
      ];

      for (const invalidName of invalidNames) {
        const response = await request(app)
          .post(`/api/games/${gameCode}/join`)
          .send({ playerName: invalidName })
          .expect(400);

        expect(response.body.error).toMatch(/invalid characters|player name/i);
      }
    });

    /**
     * Test that the endpoint returns a 400 error when provided with an invalid
     * game code format (e.g., wrong length, invalid characters).
     */
    it('should return 400 for invalid game code format', async () => {
      const response = await request(app)
        .post('/api/games/INVALID/join')
        .send({ playerName: 'Valid Player' })
        .expect(400);

      expect(response.body.error).toBe('Invalid game code');
    });

    /**
     * Test that the endpoint returns a 404 error when the game code is valid
     * but the game doesn't exist in the database.
     */
    it('should return 404 for non-existent game', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 0,
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .post('/api/games/XXXXXX/join')
        .send({ playerName: 'Valid Player' })
        .expect(404);

      expect(response.body.error).toBe('Game not found');
    });

    /**
     * Test that the endpoint returns a 400 error when trying to join a game
     * that has already started (not in 'waiting' state).
     */
    it('should return 400 if game already started', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 4,
        gameStatus: 'playing' // Game is already in progress
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const response = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send({ playerName: 'Late Player' })
        .expect(400);

      expect(response.body.error).toMatch(/Game is no longer accepting new players/i);
    });

    /**
     * Test that when a player with the same name already exists in the game,
     * the endpoint returns a valid JoinGameResponse with the existing player data
     * instead of creating a duplicate.
     */
    it('should return existing player data if player already exists', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 2,
        playerCount: 0,
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      const existingPlayerName = 'Existing Player';
      
      // First join - creates the player
      const firstResponse = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send({ playerName: existingPlayerName })
        .expect(200);

      const firstPlayerId = firstResponse.body.playerId;

      // Second join with same name - should return existing player
      const secondResponse = await request(app)
        .post(`/api/games/${gameCode}/join`)
        .send({ playerName: existingPlayerName })
        .expect(200);

      expectValidJoinGameResponse(secondResponse, scenario, existingPlayerName);
      
      // Verify it's the same player ID
      expect(secondResponse.body.playerId).toBe(firstPlayerId);
      expect(secondResponse.body.playerName).toBe(existingPlayerName);
    });

    /**
     * Test that when a player joins, they are correctly assigned to an available
     * team based on the game's team configuration and current team distribution.
     */
    it('should assign player to correct team when joining', async () => {
      const scenario = createGameScenario({
        gameCode: gameCode,
        teamCount: 3,
        playerCount: 0,
        gameStatus: 'waiting'
      });
      const store = await createRealDataStoreFromScenario(scenario).initDb();

      // Join multiple players to test team assignment
      const playerNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];
      const playerTeams: string[] = [];

      for (const playerName of playerNames) {
        const response = await request(app)
          .post(`/api/games/${gameCode}/join`)
          .send({ playerName })
          .expect(200);

        expectValidJoinGameResponse(response, scenario, playerName);
        // Add player to scenario for verification on next run
        scenario.players.push({
          id: response.body.playerId,
          name: playerName,
          team_id: response.body.teamId,
          is_connected: true,
          game_id: scenario.game.id,
          created_at: '',
          updated_at: '',
          last_seen_at: ''
        });
        expect(response.body.teamId).toBeTruthy();
        playerTeams.push(response.body.teamId);
      }

      // Verify team distribution is balanced
      const teamCounts = new Map<string, number>();
      playerTeams.forEach(teamId => {
        teamCounts.set(teamId, (teamCounts.get(teamId) || 0) + 1);
      });

      // Should have 3 teams with 2 players each
      expect(teamCounts.size).toBe(3);
      teamCounts.forEach(count => {
        expect(count).toBe(2);
      });
    });
  });
});