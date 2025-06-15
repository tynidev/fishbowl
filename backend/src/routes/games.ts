import express, { Router } from 'express';
import { createGame, getGameInfo, updateGameConfig, startGame } from '../controllers/gamesController';

const router: Router = express.Router();

// Game routes
router.post('/games', createGame);
router.get('/games/:gameCode', getGameInfo);
router.put('/games/:gameCode/config', updateGameConfig);
router.post('/games/:gameCode/start', startGame);

export default router;
