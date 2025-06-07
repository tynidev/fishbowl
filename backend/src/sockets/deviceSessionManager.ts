import { v4 as uuidv4 } from 'uuid';
import { insert, select, update, deleteRecords } from '../db/utils';
import { DeviceSession } from '../db/schema';
import { TransactionConnection, withTransaction } from '../db/connection';

// ==================== Device Session Management ====================

/**
 * Generate a unique device ID
 */
export function generateDeviceId(): string {
  return `device_${uuidv4()}`;
}

/**
 * Create or update a device session
 */
export async function createOrUpdateDeviceSession(
  transaction: TransactionConnection,
  deviceId: string,
  socketId: string,
  playerId?: string,
  gameId?: string,
): Promise<DeviceSession> {
  const sessionId = uuidv4();
  const now = new Date().toISOString();

  // Check if a session already exists for this device and game
  let existingSession: DeviceSession | null = null;

  if (gameId) {
    const sessions = await select<DeviceSession>(
      'device_sessions',
      {
        where: [
          { field: 'device_id', operator: '=', value: deviceId },
          { field: 'game_id', operator: '=', value: gameId },
        ],
      },
      transaction
    );

    existingSession = sessions.length > 0 && sessions[0] ? sessions[0] : null;
  }

  if (existingSession) {
    // Update existing session
    await update(
      'device_sessions',
      {
        socket_id: socketId,
        player_id:
          playerId !== undefined ? playerId : existingSession.player_id,
        last_seen: now,
        is_active: true,
      },
      [{ field: 'id', operator: '=', value: existingSession.id }],
      transaction
    );

    return {
      ...existingSession,
      socket_id: socketId,
      player_id:
        playerId !== undefined ? playerId : existingSession.player_id,
      last_seen: now,
      is_active: true,
      updated_at: now,
    } as DeviceSession;
  } else {
    // Create new session
    const newSession: DeviceSession = {
      id: sessionId,
      device_id: deviceId,
      socket_id: socketId,
      last_seen: now,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    if (playerId) {
      newSession.player_id = playerId;
    }
    if (gameId) {
      newSession.game_id = gameId;
    }

    await insert('device_sessions', newSession, transaction);
    return newSession;
  }
}

/**
 * Get device session by device ID and optional game ID
 */
export async function getDeviceSession(
  deviceId: string,
  gameId?: string
): Promise<DeviceSession | null> {
  return await withTransaction(async transaction => {
    const whereClause = [
      { field: 'device_id', operator: '=' as const, value: deviceId },
    ];

    if (gameId) {
      whereClause.push({
        field: 'game_id',
        operator: '=' as const,
        value: gameId,
      });
    }

    const sessions = await select<DeviceSession>(
      'device_sessions',
      {
        where: whereClause,
        orderBy: [{ field: 'last_seen', direction: 'DESC' }],
        limit: 1,
      },
      transaction
    );

    return sessions.length > 0 && sessions[0] ? sessions[0] : null;
  });
}

/**
 * Get device session by socket ID
 */
export async function getDeviceSessionBySocket(
  socketId: string
): Promise<DeviceSession | null> {
  return await withTransaction(async transaction => {
    const sessions = await select<DeviceSession>(
      'device_sessions',
      {
        where: [{ field: 'socket_id', operator: '=', value: socketId }],
        limit: 1,
      },
      transaction
    );

    return sessions.length > 0 && sessions[0] ? sessions[0] : null;
  });
}

/**
 * Update device session last seen timestamp
 */
export async function updateLastSeen(
  deviceId: string,
  gameId?: string
): Promise<void> {
  await withTransaction(async transaction => {
    const whereClause = [
      { field: 'device_id', operator: '=' as const, value: deviceId },
    ];

    if (gameId) {
      whereClause.push({
        field: 'game_id',
        operator: '=' as const,
        value: gameId,
      });
    }

    await update(
      'device_sessions',
      { last_seen: new Date().toISOString() },
      whereClause,
      transaction
    );
  });
}

/**
 * Deactivate a device session
 */
export async function deactivateDeviceSession(
  deviceId: string,
  gameId?: string
): Promise<void> {
  await withTransaction(async transaction => {
    const whereClause = [
      { field: 'device_id', operator: '=' as const, value: deviceId },
    ];

    if (gameId) {
      whereClause.push({
        field: 'game_id',
        operator: '=' as const,
        value: gameId,
      });
    }

    await update(
      'device_sessions',
      {
        is_active: false,
        socket_id: null,
        last_seen: new Date().toISOString(),
      },
      whereClause,
      transaction
    );
  });
}

/**
 * Deactivate device session by socket ID
 */
export async function deactivateDeviceSessionBySocket(
  transaction: TransactionConnection,
  socketId: string
): Promise<void> {
  await update(
    'device_sessions',
    {
      is_active: false,
      socket_id: null,
      last_seen: new Date().toISOString(),
    },
    [{ field: 'socket_id', operator: '=', value: socketId }],
    transaction
  );
}

/**
 * Get active sessions for a game
 */
export async function getActiveSessionsForGame(
  gameId: string
): Promise<DeviceSession[]> {
  return await withTransaction(async transaction => {
    return await select<DeviceSession>(
      'device_sessions',
      {
        where: [
          { field: 'game_id', operator: '=', value: gameId },
          { field: 'is_active', operator: '=', value: true },
        ],
        orderBy: [{ field: 'last_seen', direction: 'DESC' }],
      },
      transaction
    );
  });
}

/**
 * Clean up stale sessions (inactive for more than 1 hour)
 */
export async function cleanupStaleSessions(): Promise<number> {
  return await withTransaction(async transaction => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Get stale sessions count first
    const staleSessions = await select<DeviceSession>(
      'device_sessions',
      {
        where: [
          { field: 'last_seen', operator: '<', value: oneHourAgo },
          { field: 'is_active', operator: '=', value: true },
        ],
      },
      transaction
    );

    // Deactivate stale sessions
    await update(
      'device_sessions',
      {
        is_active: false,
        socket_id: null,
      },
      [
        { field: 'last_seen', operator: '<', value: oneHourAgo },
        { field: 'is_active', operator: '=', value: true },
      ],
      transaction
    );

    console.log(`Cleaned up ${staleSessions.length} stale device sessions`);
    return staleSessions.length;
  });
}

/**
 * Remove old inactive sessions (older than 24 hours)
 */
export async function removeOldSessions(): Promise<number> {
  return await withTransaction(async transaction => {
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    // Get old sessions count first
    const oldSessions = await select<DeviceSession>(
      'device_sessions',
      {
        where: [
          { field: 'last_seen', operator: '<', value: twentyFourHoursAgo },
          { field: 'is_active', operator: '=', value: false },
        ],
      },
      transaction
    );

    // Remove old inactive sessions
    await deleteRecords(
      'device_sessions',
      [
        { field: 'last_seen', operator: '<', value: twentyFourHoursAgo },
        { field: 'is_active', operator: '=', value: false },
      ],
      transaction
    );

    console.log(`Removed ${oldSessions.length} old device sessions`);
    return oldSessions.length;
  });
}

/**
 * Check if a device has an active session for a game
 */
export async function hasActiveSession(
  deviceId: string,
  gameId: string
): Promise<boolean> {
  return await withTransaction(async transaction => {
    const sessions = await select<DeviceSession>(
      'device_sessions',
      {
        where: [
          { field: 'device_id', operator: '=', value: deviceId },
          { field: 'game_id', operator: '=', value: gameId },
          { field: 'is_active', operator: '=', value: true },
        ],
      },
      transaction
    );

    return sessions.length > 0;
  });
}

/**
 * Get all device sessions for a player
 */
export async function getPlayerDeviceSessions(
  playerId: string
): Promise<DeviceSession[]> {
  return await withTransaction(async transaction => {
    return await select<DeviceSession>(
      'device_sessions',
      {
        where: [{ field: 'player_id', operator: '=', value: playerId }],
        orderBy: [{ field: 'last_seen', direction: 'DESC' }],
      },
      transaction
    );
  });
}
