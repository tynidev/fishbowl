import request from 'supertest';
import { app } from '../setupTests';
import { SubmitPhrasesRequest, UpdatePhraseRequest } from '../../src/types/rest-api';

export class PhraseApiHelper {
  constructor(private gameCode: string) {}

  submitPhrases(playerId: string, phrases: string[] | string) {
    return request(app)
      .post(`/api/games/${this.gameCode}/phrases`)
      .send({ phrases, playerId } as SubmitPhrasesRequest);
  }
  submitPhrasesInvalid(phrases: string[] | string, playerId?: string) {
    const body: any = { phrases };
    if (playerId) {
      body.playerId = playerId;
    }
    return request(app)
      .post(`/api/games/${this.gameCode}/phrases`)
      .send(body);
  }

  submitPhrasesInvalidGameCode(phrases: string[] | string, playerId?: string) {
    const body: any = { phrases };
    if (playerId) {
      body.playerId = playerId;
    }
    return request(app)
      .post(`/api/games/INVALID/phrases`)
      .send(body);
  }

  getPhrases(playerId: string) {
    return request(app)
      .get(`/api/games/${this.gameCode}/phrases?playerId=${playerId}`);
  }

  getPhrasesInvalid(playerId: string) {
    return request(app)
      .get(`/api/games/INVALID/phrases?playerId=${playerId}`);
  }

  getPhrasesWithoutPlayerId() {
    return request(app)
      .get(`/api/games/${this.gameCode}/phrases`);
  }

  getPhrasesStatus() {
    return request(app)
      .get(`/api/games/${this.gameCode}/phrases/status`);
  }

  getPhrasesStatusInvalid() {
    return request(app)
      .get(`/api/games/INVALID/phrases/status`);
  }

  updatePhrase(phraseId: string, playerId: string, text: string) {
    return request(app)
      .put(`/api/games/${this.gameCode}/phrases/${phraseId}?playerId=${playerId}`)
      .send({ text } as UpdatePhraseRequest);
  }

  deletePhrase(phraseId: string, playerId: string) {
    return request(app)
      .delete(`/api/games/${this.gameCode}/phrases/${phraseId}?playerId=${playerId}`);
  }
}

export function createPhraseApi(gameCode: string) {
  return new PhraseApiHelper(gameCode);
}
