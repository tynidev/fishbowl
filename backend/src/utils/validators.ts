/**
 * Validation utilities for the Fishbowl game API
 */

/**
 * Validate game configuration parameters
 */
export function validateGameConfig(config: {
  teamCount?: number;
  phrasesPerPlayer?: number;
  timerDuration?: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.teamCount !== undefined) {
    if (
      !Number.isInteger(config.teamCount) ||
      config.teamCount < 2 ||
      config.teamCount > 8
    ) {
      errors.push('Team count must be an integer between 2 and 8');
    }
  }

  if (config.phrasesPerPlayer !== undefined) {
    if (
      !Number.isInteger(config.phrasesPerPlayer) ||
      config.phrasesPerPlayer < 3 ||
      config.phrasesPerPlayer > 10
    ) {
      errors.push('Phrases per player must be an integer between 3 and 10');
    }
  }

  if (config.timerDuration !== undefined) {
    if (
      !Number.isInteger(config.timerDuration) ||
      config.timerDuration < 30 ||
      config.timerDuration > 180
    ) {
      errors.push(
        'Timer duration must be an integer between 30 and 180 seconds'
      );
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate player name
 */
export function validatePlayerName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Player name is required' };
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 20) {
    return {
      isValid: false,
      error: 'Player name must be between 1 and 20 characters',
    };
  }

  // Check for valid characters (letters, numbers, spaces, basic punctuation)
  if (!/^[a-zA-Z0-9\s\-_'.]+$/.test(trimmedName)) {
    return { isValid: false, error: 'Player name contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Validate phrase text
 */
export function validatePhrase(text: string): { isValid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Phrase text is required' };
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 1) {
    return { isValid: false, error: 'Phrase cannot be empty' };
  }

  if (trimmedText.length > 100) {
    return { isValid: false, error: 'Phrase must be 100 characters or less' };
  }

  // Check for reasonable characters (allow most printable characters)
  if (!/^[\w\s\-_'.,!?()]+$/.test(trimmedText)) {
    return { isValid: false, error: 'Phrase contains invalid characters' };
  }

  return { isValid: true };
}

/**
 * Validate array of phrases
 */
export function validatePhrases(phrases: string[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(phrases)) {
    return { isValid: false, errors: ['Phrases must be an array'] };
  }

  if (phrases.length === 0) {
    return { isValid: false, errors: ['At least one phrase is required'] };
  }

  for (let i = 0; i < phrases.length; i++) {
    const phrase = phrases[i];
    if (!phrase) {
      errors.push(`Phrase ${i + 1}: Phrase is required`);
      continue;
    }

    const validation = validatePhrase(phrase);

    if (!validation.isValid) {
      errors.push(`Phrase ${i + 1}: ${validation.error}`);
      continue;
    }

    const trimmedPhrase = phrase.trim().toLowerCase();
    if (seen.has(trimmedPhrase)) {
      errors.push(`Phrase ${i + 1}: Duplicate phrase "${phrase.trim()}"`);
    } else {
      seen.add(trimmedPhrase);
    }
  }

  return { isValid: errors.length === 0, errors };
}
