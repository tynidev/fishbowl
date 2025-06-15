import { Game, Phrase, Player, Team } from "../../src/db/schema";
import * as dbUtils from '../../src/db/utils';
import { withTransaction } from '../../src/db/connection';
import { WhereCondition } from "../../src/db/utils";

export function createRealDataStoreFromScenario(scenario: { 
  game: Game; 
  players: Player[]; 
  teams: Team[]; 
  phrases?: Phrase[] 
}) {
  const store = {
    async initDb() {
      // Instead of setting up mocks, insert real data into the test database
      await withTransaction(async (transaction) => {
        // Clear existing data
        await transaction.run('DELETE FROM phrases');
        await transaction.run('DELETE FROM players');
        await transaction.run('DELETE FROM teams');
        await transaction.run('DELETE FROM games');
        
        // Insert game
        await dbUtils.insert('games', scenario.game, transaction);
        
        // Insert teams
        for (const team of scenario.teams) {
          await dbUtils.insert('teams', team, transaction);
        }
        
        // Insert players
        for (const player of scenario.players) {
          await dbUtils.insert('players', player, transaction);
        }
        
        // Insert phrases if provided
        if (scenario.phrases) {
          for (const phrase of scenario.phrases) {
            await dbUtils.insert('phrases', phrase, transaction);
          }
        }
      });
      
      return this;
    },
    
    async addGame(game: Game) {
      await dbUtils.insert('games', game);
      return this;
    },
    
    async addPlayer(player: Player) {
      await dbUtils.insert('players', player);
      return this;
    },
    
    async addTeam(team: Team) {
      await dbUtils.insert('teams', team);
      return this;
    },
    
    async addPhrase(phrase: Phrase) {
      await dbUtils.insert('phrases', phrase);
      return this;
    },

    async findById(type: string, id: string) {
      return await dbUtils.findById(type, id);
    },

    async deleteById(type: string, id: string) {
      const condition: WhereCondition = { 'field': 'id', 'value': id, 'operator': '=' };
      await dbUtils.deleteRecords(type, [condition]);
    },

    async updateById(type: string, id: string, data: any) {
      const condition: WhereCondition = { 'field': 'id', 'value': id, 'operator': '=' };
      await dbUtils.update(type, data, [condition]);
    }
  };
  
  return store;
}