/**
 * Code generation utilities for the Fishbowl game
 */

/**
 * Generate a unique 6-character alphanumeric game code
 */
export function generateGameCode(): string
{
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++)
  {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
