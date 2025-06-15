/**
 * Device Session Utility Functions
 * 
 * Transformation utilities for converting database objects to REST API response formats
 * specific to device session endpoints. These functions handle the mapping between
 * internal database representations and external API contracts.
 */

import { Game, Player } from '../db/schema';
import {
  DeviceSessionResponse,
  PlayerInfoResponse,
  DeviceSessionGameInfoResponse,
} from '../types/rest-api';

/**
 * Transform device session to response format
 * 
 * @param session Raw device session object from database
 * @returns Formatted device session response object
 */
export function transformDeviceSession(session: any): DeviceSessionResponse {
  return {
    id: session.id,
    deviceId: session.device_id,
    socketId: session.socket_id || null,
    lastSeen: session.last_seen,
    isActive: session.is_active,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

/**
 * Transform player to response format for device session endpoints
 * 
 * @param player Player database object
 * @returns Formatted player info response object
 */
export function transformPlayer(player: Player): PlayerInfoResponse {
  return {
    id: player.id,
    name: player.name,
    gameId: player.game_id,
    teamId: player.team_id || null,
    isConnected: Boolean(player.is_connected),
  };
}

/**
 * Transform game to response format for device session endpoints
 * 
 * @param game Game database object
 * @returns Formatted game info response object (simplified for device sessions)
 */
export function transformGame(game: Game): DeviceSessionGameInfoResponse {
  return {
    id: game.id,
    name: game.name,
    status: game.status,
    sub_status: game.sub_status,
    hostPlayerId: game.host_player_id,
  };
}