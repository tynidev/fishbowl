import express, { Router } from 'express';
import {
  submitPhrases,
  getGamePhrases,
  getPhraseSubmissionStatus,
  updatePhrase,
  deletePhrase,
} from '../controllers/phrasesController';

const router: Router = express.Router();

// Phrase routes
router.post('/games/:gameCode/phrases', submitPhrases);
router.get('/games/:gameCode/phrases', getGamePhrases);
router.get('/games/:gameCode/phrases/status', getPhraseSubmissionStatus);
router.put('/games/:gameCode/phrases/:phraseId', updatePhrase);
router.delete('/games/:gameCode/phrases/:phraseId', deletePhrase);

export default router;
