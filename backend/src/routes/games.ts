import express, { Router } from 'express';
import { createGame, getGameInfo, startGame, startRound, updateGameConfig } from '../controllers/gamesController';

const router: Router = express.Router();

// Game routes
router.post('/games', createGame);
router.get('/games/:gameCode', getGameInfo);
router.put('/games/:gameCode/config', updateGameConfig);
router.post('/games/:gameCode/start', startGame);
router.post('/games/:gameCode/rounds/start', startRound);

export default router;
