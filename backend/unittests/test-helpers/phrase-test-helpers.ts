import { createGameScenario } from './test-helpers';
import { phraseFactory } from './test-factories';
import { createRealDataStoreFromScenario } from './realDbUtils';

export interface SetupGameWithPhrasesOptions {
  gameCode: string;
  gameStatus?: "waiting" | "phrase_submission" | "playing" | "finished";
  playerCount?: number;
  teamCount?: number;
  phrasesPerPlayer?: number;
  phrases?: Array<{
    playerId: string;
    text: string;
  }>;
}

export async function setupGameWithPhrases(options: SetupGameWithPhrasesOptions) {
  const {
    gameCode,
    gameStatus = 'phrase_submission',
    playerCount = 2,
    teamCount = 2,
    phrasesPerPlayer = 5,
    phrases = []
  } = options;

  const scenario = createGameScenario({
    gameCode,
    gameStatus,
    playerCount,
    teamCount,
    phrasesPerPlayer
  });

  const store = await createRealDataStoreFromScenario(scenario).initDb();

  // Add any specified phrases
  for (const phrase of phrases) {
    await store.addPhrase(
      phraseFactory.create(gameCode, phrase.playerId, phrase.text)
    );
  }

  return { scenario, store };
}

export function createPhrasesForPlayer(
  gameCode: string,
  playerId: string,
  phraseTexts: string[]
) {
  return phraseTexts.map(text => 
    phraseFactory.create(gameCode, playerId, text)
  );
}

export async function addPhrasesToStore(
  store: any,
  gameCode: string,
  playerId: string,
  phraseTexts: string[]
) {
  const phrases = createPhrasesForPlayer(gameCode, playerId, phraseTexts);
  for (const phrase of phrases) {
    await store.addPhrase(phrase);
  }
  return phrases;
}
