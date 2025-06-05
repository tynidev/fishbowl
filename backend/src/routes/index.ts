import express, { Router } from 'express';
import gamesRouter from './games';
import playersRouter from './players';
import phrasesRouter from './phrases';

const router: Router = express.Router();

// Mount sub-routers
router.use('/', gamesRouter);
router.use('/', playersRouter);
router.use('/', phrasesRouter);

export default router;
