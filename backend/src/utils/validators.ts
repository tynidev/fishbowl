/**
 * Validation utilities for the Fishbowl game API
 */

/**
 * Validates game configuration settings for the Fishbowl game.
 *
 * This function performs comprehensive validation on game configuration parameters:
 * - Validates team count (2-8 teams)
 * - Validates phrases per player (3-10 phrases)
 * - Validates timer duration (30-180 seconds)
 * - Returns detailed error messages for each invalid configuration option
 *
 * @param config - Configuration object containing optional game settings
 * @param config.teamCount - Number of teams (optional, must be 2-8 if provided)
 * @param config.phrasesPerPlayer - Number of phrases per player (optional, must be 3-10 if provided)
 * @param config.timerDuration - Timer duration in seconds (optional, must be 30-180 if provided)
 * @returns An object containing:
 *   - isValid: boolean indicating if all configuration options pass validation
 *   - errors: Array of error messages describing validation failures
 *
 * @example
 * ```typescript
 * const result = validateGameConfig({ teamCount: 10, phrasesPerPlayer: 5 });
 * // Returns: { isValid: false, errors: ['Team count must be an integer between 2 and 8'] }
 * ```
 */
export function validateGameConfig(config: {
  teamCount?: number;
  phrasesPerPlayer?: number;
  timerDuration?: number;
}): { isValid: boolean; errors: string[]; }
{
  const errors: string[] = [];

  if (config.teamCount !== undefined)
  {
    if (
      !Number.isInteger(config.teamCount) ||
      config.teamCount < 2 ||
      config.teamCount > 8
    )
    {
      errors.push('Team count must be an integer between 2 and 8');
    }
  }

  if (config.phrasesPerPlayer !== undefined)
  {
    if (
      !Number.isInteger(config.phrasesPerPlayer) ||
      config.phrasesPerPlayer < 3 ||
      config.phrasesPerPlayer > 10
    )
    {
      errors.push('Phrases per player must be an integer between 3 and 10');
    }
  }

  if (config.timerDuration !== undefined)
  {
    if (
      !Number.isInteger(config.timerDuration) ||
      config.timerDuration < 30 ||
      config.timerDuration > 180
    )
    {
      errors.push(
        'Timer duration must be an integer between 30 and 180 seconds',
      );
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a player name for use in the Fishbowl game.
 *
 * This function performs comprehensive validation on player names:
 * - Ensures the input is a non-empty string
 * - Validates length requirements (1-20 characters after trimming)
 * - Checks for allowed characters (letters, numbers, spaces, hyphens, underscores, apostrophes, periods)
 * - Returns a detailed error message if validation fails
 *
 * @param name - The player name string to validate
 * @returns An object containing:
 *   - isValid: boolean indicating if the player name passes validation
 *   - error: Optional error message describing the validation failure
 *
 * @example
 * ```typescript
 * const result = validatePlayerName('John Doe');
 * // Returns: { isValid: true }
 *
 * const invalidResult = validatePlayerName('');
 * // Returns: { isValid: false, error: 'Player name is required' }
 * ```
 */
export function validatePlayerName(name: string): {
  isValid: boolean;
  error?: string;
}
{
  if (!name || typeof name !== 'string')
  {
    return { isValid: false, error: 'Player name is required' };
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 20)
  {
    return {
      isValid: false,
      error: 'Player name must be between 1 and 20 characters',
    };
  }

  // Check for valid characters (letters, numbers, spaces, basic punctuation)
  if (!/^[a-zA-Z0-9\s\-_'.]+$/.test(trimmedName))
  {
    return { isValid: false, error: 'Player name contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Validates a single phrase text for use in the Fishbowl game.
 *
 * This function performs comprehensive validation on individual phrases:
 * - Ensures the input is a non-empty string
 * - Validates length requirements (1-100 characters after trimming)
 * - Checks for allowed characters (word characters, spaces, and common punctuation)
 * - Returns a detailed error message if validation fails
 *
 * @param text - The phrase text string to validate
 * @returns An object containing:
 *   - isValid: boolean indicating if the phrase passes validation
 *   - error: Optional error message describing the validation failure
 *
 * @example
 * ```typescript
 * const result = validatePhrase('Harry Potter');
 * // Returns: { isValid: true }
 *
 * const invalidResult = validatePhrase('');
 * // Returns: { isValid: false, error: 'Phrase cannot be empty' }
 * ```
 */
export function validatePhrase(text: string): {
  isValid: boolean;
  error?: string;
}
{
  if (!text || typeof text !== 'string')
  {
    return { isValid: false, error: 'Phrase text is required' };
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 1)
  {
    return { isValid: false, error: 'Phrase cannot be empty' };
  }

  if (trimmedText.length > 100)
  {
    return { isValid: false, error: 'Phrase must be 100 characters or less' };
  }

  // Check for reasonable characters (allow most printable characters)
  if (!/^[\w\s\-_'.,!?()]+$/.test(trimmedText))
  {
    return { isValid: false, error: 'Phrase contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Validates an array of phrase strings for use in the Fishbowl game.
 *
 * This function performs comprehensive validation on a collection of phrases:
 * - Ensures the input is a valid array
 * - Verifies at least one phrase is provided
 * - Validates each individual phrase using the validatePhrase function
 * - Checks for duplicate phrases (case-insensitive comparison)
 * - Returns detailed error messages for each invalid phrase, including its position
 *
 * @param phrases - Array of phrase strings to validate
 * @returns An object containing:
 *   - isValid: boolean indicating if all phrases pass validation
 *   - errors: Array of error messages describing validation failures
 *
 * @example
 * ```typescript
 * const result = validatePhrases(['Hello world', 'Test phrase', 'Hello World']);
 * // Returns: { isValid: false, errors: ['Phrase 3: Duplicate phrase "Hello World"'] }
 *
 * const validResult = validatePhrases(['Unique phrase 1', 'Unique phrase 2']);
 * // Returns: { isValid: true, errors: [] }
 * ```
 */
export function validatePhrases(phrases: string[]): {
  isValid: boolean;
  errors: string[];
}
{
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(phrases))
  {
    return { isValid: false, errors: ['Phrases must be an array'] };
  }

  if (phrases.length === 0)
  {
    return { isValid: false, errors: ['At least one phrase is required'] };
  }

  for (let i = 0; i < phrases.length; i++)
  {
    const phrase = phrases[i];
    if (!phrase)
    {
      errors.push(`Phrase ${i + 1}: Phrase is required`);
      continue;
    }

    const validation = validatePhrase(phrase);

    if (!validation.isValid)
    {
      errors.push(`Phrase ${i + 1}: ${validation.error}`);
      continue;
    }

    const trimmedPhrase = phrase.trim().toLowerCase();
    if (seen.has(trimmedPhrase))
    {
      errors.push(`Phrase ${i + 1}: Duplicate phrase "${phrase.trim()}"`);
    }
    else
    {
      seen.add(trimmedPhrase);
    }
  }

  return { isValid: errors.length === 0, errors };
}
