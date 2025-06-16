import express, { Router } from 'express';
import gamesRouter from './games';
import playersRouter from './players';
import phrasesRouter from './phrases';
import deviceSessionsRouter from './deviceSessions';
import turnsRouter from './turns';

const router: Router = express.Router();

// Mount sub-routers
router.use('/', gamesRouter);
router.use('/', playersRouter);
router.use('/', phrasesRouter);
router.use('/device-sessions', deviceSessionsRouter);
router.use('/', turnsRouter);

export default router;
