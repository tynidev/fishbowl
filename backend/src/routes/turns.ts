import express, { Router } from 'express';
import { endTurn } from '../controllers/turnsController';

const router: Router = express.Router();

// Turn routes
router.post('/games/:gameId/turns/end', endTurn);

export default router;
