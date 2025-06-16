/**
 * Device Sessions Controller
 *
 * Handles all device session-related HTTP operations including:
 * - Device ID generation
 * - Session information retrieval
 * - Active session checking and management
 * - Session cleanup and administration
 */

import { Request, Response } from 'express';
import {
  getDeviceSession,
  getActiveSessionsForGame,
  hasActiveSession,
  deactivateDeviceSession,
  generateDeviceId,
  cleanupStaleSessions,
  removeOldSessions,
} from '../sockets/deviceSessionManager';
import { findById } from '../db/utils';
import { Game, Player } from '../db/schema';
import {
  GetDeviceSessionResponse,
  GenerateDeviceIdResponse,
  CheckActiveSessionResponse,
  ActiveSessionInfo,
  GetActiveSessionsResponse,
  DeactivateSessionRequest,
  DeactivateSessionResponse,
  CleanupSessionsResponse,
} from '../types/rest-api';
import {
  transformDeviceSession,
  transformPlayer,
  transformGame,
} from '../utils/deviceSessionUtils';

// ==================== Route Handlers ====================

/**
 * GET /api/device-sessions/generate-id - Generate a new device ID
 */
export async function generateNewDeviceId(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const deviceId = generateDeviceId();

    const response: GenerateDeviceIdResponse = {
      success: true,
      deviceId,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error generating device ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate device ID',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/device-sessions/:deviceId - Get device session information
 * Query params: gameId (optional)
 */
export async function getDeviceSessionInfo(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { deviceId } = req.params;
    const { gameId } = req.query;

    if (!deviceId) {
      res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
      return;
    }

    const session = await getDeviceSession(deviceId, gameId as string);

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'No session found for this device',
      });
      return;
    }

    // Get additional player/game information if available
    let playerInfo = null;
    let gameInfo = null;

    if (session.player_id) {
      const player = await findById<Player>('players', session.player_id);
      if (player) {
        playerInfo = transformPlayer(player);
      }
    }

    if (session.game_id) {
      const game = await findById<Game>('games', session.game_id);
      if (game) {
        gameInfo = transformGame(game);
      }
    }

    const response: GetDeviceSessionResponse = {
      success: true,
      session: transformDeviceSession(session),
      player: playerInfo,
      game: gameInfo,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting device session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get device session',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/device-sessions/:deviceId/active/:gameId - Check if device has active session for a game
 */
export async function checkActiveSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { deviceId, gameId } = req.params;

    if (!deviceId || !gameId) {
      res.status(400).json({
        success: false,
        message: 'Device ID and Game ID are required',
      });
      return;
    }

    const isActive = await hasActiveSession(deviceId, gameId);

    const response: CheckActiveSessionResponse = {
      success: true,
      hasActiveSession: isActive,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error checking active session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check active session',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/device-sessions/game/:gameId/active - Get all active sessions for a game
 */
export async function getGameActiveSessions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: 'Game ID is required',
      });
      return;
    }

    // Verify game exists
    const game = await findById<Game>('games', gameId);
    if (!game) {
      res.status(404).json({
        success: false,
        message: 'Game not found',
      });
      return;
    }

    const sessions = await getActiveSessionsForGame(gameId);

    // Get player information for each session
    const sessionsWithPlayers = await Promise.all(
      sessions.map(async (session): Promise<ActiveSessionInfo> => {
        let playerInfo = null;
        if (session.player_id) {
          const player = await findById<Player>('players', session.player_id);
          if (player) {
            playerInfo = transformPlayer(player);
          }
        }

        return {
          id: session.id,
          deviceId: session.device_id,
          socketId: session.socket_id || null,
          lastSeen: session.last_seen,
          isActive: session.is_active,
          player: playerInfo,
        };
      })
    );

    const response: GetActiveSessionsResponse = {
      success: true,
      gameId,
      activeSessions: sessionsWithPlayers,
      count: sessionsWithPlayers.length,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting active sessions for game:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active sessions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/device-sessions/:deviceId/deactivate - Deactivate a device session
 */
export async function deactivateSession(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { deviceId } = req.params;
    const { gameId }: DeactivateSessionRequest = req.body;

    if (!deviceId) {
      res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
      return;
    }

    await deactivateDeviceSession(deviceId, gameId);

    const response: DeactivateSessionResponse = {
      success: true,
      message: 'Device session deactivated successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error deactivating device session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate device session',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/device-sessions/admin/cleanup - Cleanup stale sessions (admin endpoint)
 */
export async function cleanupSessions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const staleCount = await cleanupStaleSessions();
    const removedCount = await removeOldSessions();

    const response: CleanupSessionsResponse = {
      success: true,
      message: 'Session cleanup completed',
      staleSessionsDeactivated: staleCount,
      oldSessionsRemoved: removedCount,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error during session cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup sessions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
