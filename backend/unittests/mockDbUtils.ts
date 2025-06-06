import { Game, Phrase, Player, Team } from "../src/db/schema";
import { QueryOptions } from "../src/db/utils";
import { mockedDbUtils } from "./test-helpers";

/**
 * Mocks database select queries with dynamic implementation
 * This function sets up mockedDbUtils.select to return different entities based on the table name
 */
function mockSelect(
  games: Record<string, Game> = {},
  players: Record<string, Player> = {},
  teams: Record<string, Team> = {},
  phrases: Record<string, Phrase> = {}
): void {
  mockedDbUtils.select.mockImplementation(
    async <T = any>(tableName: string, options?: QueryOptions, _connection?: any): Promise<T[]> => {
      let results: T[] = [];
      
      switch (tableName) {
        case 'games':
          results = games && Object.keys(games).length > 0 ? (Object.values(games) as unknown as T[]) : [];
          break;
        case 'players':
          results = players && Object.keys(players).length > 0 ? (Object.values(players) as unknown as T[]) : [];
          break;
        case 'teams':
          results = teams && Object.keys(teams).length > 0 ? (Object.values(teams) as unknown as T[]) : [];
          break;
        case 'phrases':
          results = phrases && Object.keys(phrases).length > 0 ? (Object.values(phrases) as unknown as T[]) : [];
          break;
        default:
          return [] as T[];
      }

      // Apply filtering if options are provided
      if (options && options.where && Array.isArray(options.where) && options.where.length > 0) {
        results = results.filter((item: any) => {
          return options.where!.every((condition: any) => {
            const { field, operator, value } = condition;
            const itemValue = item[field];
            
            switch (operator) {
              case '=':
                return itemValue === value;
              case '!=':
                return itemValue !== value;
              case '>':
                return itemValue > value;
              case '<':
                return itemValue < value;
              case '>=':
                return itemValue >= value;
              case '<=':
                return itemValue <= value;
              case 'LIKE':
                return typeof itemValue === 'string' && typeof value === 'string' && 
                       itemValue.toLowerCase().includes(value.toLowerCase());
              case 'IN':
                return Array.isArray(value) && value.includes(itemValue);
              default:
                return itemValue === value;
            }
          });
        });
      }

      return results;
    }
  );
}


/**
 * Mock database lookup with dynamic implementation based on table and ID
 * Sets up mockedDbUtils.findById to return different entities based on the table name and ID
 */
function mockFindById(
  games: Record<string, Game> = {},
  players: Record<string, Player> = {},
  teams: Record<string, Team> = {},
  phrases: Record<string, Phrase> = {}
): void {
  mockedDbUtils.findById.mockImplementation(async <T = any>(tableName: string, id: string, _connection?: any): Promise<T | undefined> => {
    switch (tableName) {
      case 'games':
        return (games[id] as T) || undefined;
      case 'players':
        return (players[id] as T) || undefined;
      case 'teams':
        return (teams[id] as T) || undefined;
      case 'phrases':
        return (phrases[id] as T) || undefined;
      default:
        return undefined;
    }
  });
}

function mockUpdate(
  games: Record<string, Game> = {},
  players: Record<string, Player> = {},
  teams: Record<string, Team> = {},
  phrases: Record<string, Phrase> = {}
): void {
  mockedDbUtils.update.mockImplementation(async <T extends Record<string, any>>(tableName: string, data: T, conditions: any[], _connection?: any): Promise<number> => {
    // Find the id from the conditions array (assuming condition is { field: 'id', value: ... })
    const idCondition = conditions.find((cond: any) => cond.field === 'id');
    const id = idCondition ? idCondition.value : undefined;
    if (!id) {
      return 0; // No ID provided, nothing to update
    }
    switch (tableName) {
      case 'games':
        if (id && games[id]) {
          games[id] = { ...games[id], ...data };
          return 1; // number of rows updated
        }
        return 0;
      case 'players':
        if (id && players[id]) {
          players[id] = { ...players[id], ...data };
          return 1; // number of rows updated
        }
        return 0;
      case 'teams':
        if (id && teams[id]) {
          teams[id] = { ...teams[id], ...data };
          return 1; // number of rows updated
        }
        return 0;
      case 'phrases':
        if (id && phrases[id]) {
          phrases[id] = { ...phrases[id], ...data };
          return 1; // number of rows updated
        }
        return 0;
      default:
        return 0;
    }
  });
}

/**
 * Create a mock data store for use with setupDynamicFindByIdMock
 * This helper makes it easy to build the data structures needed
 */
export function createMockDataStoreFromScenario(scenario: { game: Game; players: Player[]; teams: Team[]; phrases?: Phrase[] }) {
  const store = {
    games: { [scenario.game.id]: scenario.game } as Record<string, Game>,
    players: {} as Record<string, Player>,
    teams: {} as Record<string, Team>,
    phrases: {} as Record<string, Phrase>,

    addGame(game: Game) {
      this.games[game.id] = game;
      return this;
    },

    addPlayer(player: Player) {
      this.players[player.id] = player;
      return this;
    },

    addTeam(team: Team) {
      this.teams[team.id] = team;
      return this;
    },

    addPhrase(phrase: Phrase) {
      this.phrases[phrase.id] = phrase;
      return this;
    },

    setupMocks() {
      mockFindById(this.games, this.players, this.teams, this.phrases);
      mockSelect(this.games, this.players, this.teams, this.phrases);
      mockUpdate(this.games, this.players, this.teams, this.phrases);
      return this;
    }
  };

  scenario.players.forEach(player => store.addPlayer(player));
  scenario.teams.forEach(team => store.addTeam(team));
  if (scenario.phrases) {
    scenario.phrases.forEach(phrase => store.addPhrase(phrase));
  }

  return store;
}