import express, { Router } from 'express';
import { joinGame, getGamePlayers } from '../controllers/playersController';

const router: Router = express.Router();

// Player routes
router.post('/games/:gameCode/join', joinGame);
router.get('/games/:gameCode/players', getGamePlayers);

export default router;
