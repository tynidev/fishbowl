import express, { Router } from 'express';
import { createGame, getGameInfo, updateGameConfig } from '../controllers/gamesController';

const router: Router = express.Router();

// Game routes
router.post('/games', createGame);
router.get('/games/:gameCode', getGameInfo);
router.put('/games/:gameCode/config', updateGameConfig);

export default router;
