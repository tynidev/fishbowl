import express, { Router } from 'express';
import deviceSessionsRouter from './deviceSessions';
import gamesRouter from './games';
import phrasesRouter from './phrases';
import playersRouter from './players';
import turnsRouter from './turns';

const router: Router = express.Router();

// Mount sub-routers
router.use('/', gamesRouter);
router.use('/', playersRouter);
router.use('/', phrasesRouter);
router.use('/device-sessions', deviceSessionsRouter);
router.use('/', turnsRouter);

export default router;
