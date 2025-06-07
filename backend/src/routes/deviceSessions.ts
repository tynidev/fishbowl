/**
 * Device Sessions Routes
 * 
 * Defines HTTP routes for device session management.
 * All business logic is handled by the deviceSessionsController.
 */

import express, { Router } from 'express';
import {
  generateNewDeviceId,
  getDeviceSessionInfo,
  checkActiveSession,
  getGameActiveSessions,
  deactivateSession,
  cleanupSessions,
} from '../controllers/deviceSessionsController';

const router: Router = express.Router();

// Device session management routes
router.get('/generate-id', generateNewDeviceId);
router.get('/:deviceId', getDeviceSessionInfo);
router.get('/:deviceId/active/:gameId', checkActiveSession);
router.get('/game/:gameId/active', getGameActiveSessions);
router.post('/:deviceId/deactivate', deactivateSession);
router.post('/admin/cleanup', cleanupSessions);

export default router;
