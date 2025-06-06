/**
 * Unit tests for validation utilities
 */

import {
  validateGameConfig,
  validatePlayerName,
  validatePhrase,
  validatePhrases
} from '../src/utils/validators';

describe('validateGameConfig', () => {  // Test data for valid configurations
  const validConfigs = [
    { config: { teamCount: 4 }, description: 'valid team count' },
    { config: { phrasesPerPlayer: 5 }, description: 'valid phrases per player' },
    { config: { timerDuration: 60 }, description: 'valid timer duration' },
    { config: { teamCount: 4, phrasesPerPlayer: 5, timerDuration: 90 }, description: 'all valid parameters together' },
    { config: {}, description: 'empty configuration' }
  ];

  // Test data for boundary values
  const boundaryConfigs = [
    { config: { teamCount: 2 }, description: 'minimum team count (2)' },
    { config: { teamCount: 8 }, description: 'maximum team count (8)' },
    { config: { phrasesPerPlayer: 3 }, description: 'minimum phrases per player (3)' },
    { config: { phrasesPerPlayer: 10 }, description: 'maximum phrases per player (10)' },
    { config: { timerDuration: 30 }, description: 'minimum timer duration (30)' },
    { config: { timerDuration: 180 }, description: 'maximum timer duration (180)' }
  ];

  // Test data for invalid configurations
  const invalidConfigs = [
    { config: { teamCount: 1 }, expectedError: 'Team count must be an integer between 2 and 8', description: 'team count below minimum' },
    { config: { teamCount: 9 }, expectedError: 'Team count must be an integer between 2 and 8', description: 'team count above maximum' },
    { config: { teamCount: 3.5 }, expectedError: 'Team count must be an integer between 2 and 8', description: 'non-integer team count' },
    { config: { phrasesPerPlayer: 2 }, expectedError: 'Phrases per player must be an integer between 3 and 10', description: 'phrases per player below minimum' },
    { config: { phrasesPerPlayer: 11 }, expectedError: 'Phrases per player must be an integer between 3 and 10', description: 'phrases per player above maximum' },
    { config: { phrasesPerPlayer: 4.7 }, expectedError: 'Phrases per player must be an integer between 3 and 10', description: 'non-integer phrases per player' },
    { config: { timerDuration: 29 }, expectedError: 'Timer duration must be an integer between 30 and 180 seconds', description: 'timer duration below minimum' },
    { config: { timerDuration: 181 }, expectedError: 'Timer duration must be an integer between 30 and 180 seconds', description: 'timer duration above maximum' },
    { config: { timerDuration: 60.5 }, expectedError: 'Timer duration must be an integer between 30 and 180 seconds', description: 'non-integer timer duration' }
  ];

  describe('valid configurations', () => {
    it.each(validConfigs)('should accept $description', ({ config }) => {
      const result = validateGameConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept undefined values', () => {
      const config: any = {
        teamCount: undefined,
        phrasesPerPlayer: undefined,
        timerDuration: undefined
      };
      const result = validateGameConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('boundary values', () => {
    it.each(boundaryConfigs)('should accept $description', ({ config }) => {
      const result = validateGameConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('invalid configurations', () => {
    it.each(invalidConfigs)('should reject $description', ({ config, expectedError }) => {
      const result = validateGameConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expectedError);
    });

    it('should return multiple errors for multiple invalid parameters', () => {
      const result = validateGameConfig({
        teamCount: 1,
        phrasesPerPlayer: 2,
        timerDuration: 200
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Team count must be an integer between 2 and 8');
      expect(result.errors).toContain('Phrases per player must be an integer between 3 and 10');
      expect(result.errors).toContain('Timer duration must be an integer between 30 and 180 seconds');
    });
  });
});

describe('validatePlayerName', () => {
  // Test data for valid names
  const validNames = [
    { name: 'A', description: 'single character name' },
    { name: 'John', description: 'simple name' },
    { name: 'John Doe', description: 'name with spaces' },
    { name: 'Player123', description: 'name with numbers' },
    { name: "O'Connor-Smith_Jr.", description: 'name with allowed punctuation' },
    { name: 'A'.repeat(20), description: 'maximum length name (20 characters)' },
    { name: '  John  ', description: 'name with leading/trailing spaces (trimmed)' }
  ];

  // Test data for invalid names - grouped by error type
  const requiredErrorCases = [
    { name: null, description: 'null name' },
    { name: undefined, description: 'undefined name' },
    { name: '', description: 'empty string' },
    { name: 123, description: 'non-string input' }
  ];

  const lengthErrorCases = [
    { name: '   ', description: 'string with only spaces' },
    { name: 'A'.repeat(21), description: 'name exceeding maximum length' }
  ];

  const invalidCharacterCases = [
    { name: 'John@Doe', description: 'name with @ character' },
    { name: 'Player#1', description: 'name with # character' },
    { name: 'John😀', description: 'name with emoji' },
    { name: 'John$%&', description: 'name with special symbols' }
  ];

  describe('valid names', () => {
    it.each(validNames)('should accept $description', ({ name }) => {
      const result = validatePlayerName(name);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid names', () => {
    it.each(requiredErrorCases)('should reject $description', ({ name }) => {
      const result = validatePlayerName(name as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Player name is required');
    });

    it.each(lengthErrorCases)('should reject $description', ({ name }) => {
      const result = validatePlayerName(name);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Player name must be between 1 and 20 characters');
    });

    it.each(invalidCharacterCases)('should reject $description', ({ name }) => {
      const result = validatePlayerName(name);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Player name contains invalid characters');
    });
  });
});

describe('validatePhrase', () => {
  // Test data for valid phrases
  const validPhrases = [
    { phrase: 'A', description: 'single character phrase' },
    { phrase: 'Hello world', description: 'simple phrase' },
    { phrase: "It's a beautiful day, isn't it?!", description: 'phrase with allowed punctuation' },
    { phrase: 'The movie (2023) was great', description: 'phrase with parentheses' },
    { phrase: 'Player 123 wins the game', description: 'phrase with numbers' },
    { phrase: 'A'.repeat(100), description: 'maximum length phrase (100 characters)' },
    { phrase: '  Hello world  ', description: 'phrase with leading/trailing spaces (trimmed)' }
  ];

  // Test data for invalid phrases - grouped by error type
  const requiredErrorCases = [
    { phrase: null, description: 'null phrase' },
    { phrase: undefined, description: 'undefined phrase' },
    { phrase: '', description: 'empty string' },
    { phrase: 123, description: 'non-string input' }
  ];

  const emptyErrorCases = [
    { phrase: '   ', description: 'string with only spaces' }
  ];

  const lengthErrorCases = [
    { phrase: 'A'.repeat(101), description: 'phrase exceeding maximum length' }
  ];

  const invalidCharacterCases = [
    { phrase: 'Email me @ test.com', description: 'phrase with @ character' },
    { phrase: 'Hashtag #trending', description: 'phrase with # character' },
    { phrase: 'Happy face 😀', description: 'phrase with emoji' },
    { phrase: 'Price $100 & tax %', description: 'phrase with special symbols' }
  ];

  describe('valid phrases', () => {
    it.each(validPhrases)('should accept $description', ({ phrase }) => {
      const result = validatePhrase(phrase);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid phrases', () => {
    it.each(requiredErrorCases)('should reject $description', ({ phrase }) => {
      const result = validatePhrase(phrase as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phrase text is required');
    });

    it.each(emptyErrorCases)('should reject $description', ({ phrase }) => {
      const result = validatePhrase(phrase);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phrase cannot be empty');
    });

    it.each(lengthErrorCases)('should reject $description', ({ phrase }) => {
      const result = validatePhrase(phrase);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phrase must be 100 characters or less');
    });

    it.each(invalidCharacterCases)('should reject $description', ({ phrase }) => {
      const result = validatePhrase(phrase);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Phrase contains invalid characters');
    });
  });
});

describe('validatePhrases', () => {
  // Test data for valid phrase arrays
  const validPhraseArrays = [
    { 
      phrases: ['Hello world'], 
      description: 'single valid phrase' 
    },
    { 
      phrases: ['First phrase', 'Second phrase', 'Third phrase'], 
      description: 'multiple valid phrases' 
    },
    { 
      phrases: ['Simple phrase', "It's a complex phrase, isn't it?!", 'Phrase with numbers 123', 'Movie title (2023)'], 
      description: 'phrases with varied content' 
    }
  ];

  // Test data for input validation errors
  const inputValidationErrors = [
    { phrases: 'not an array', expectedError: 'Phrases must be an array', description: 'non-array input' },
    { phrases: null, expectedError: 'Phrases must be an array', description: 'null input' },
    { phrases: undefined, expectedError: 'Phrases must be an array', description: 'undefined input' },
    { phrases: [], expectedError: 'At least one phrase is required', description: 'empty array' }
  ];

  // Test data for individual phrase errors
  const phraseErrors = [
    { phrases: ['Valid phrase', null], expectedErrors: ['Phrase 2: Phrase is required'], description: 'array with null phrase' },
    { phrases: ['Valid phrase', undefined], expectedErrors: ['Phrase 2: Phrase is required'], description: 'array with undefined phrase' },
    { phrases: ['Valid phrase', ''], expectedErrors: ['Phrase 2: Phrase is required'], description: 'array with empty string phrase' },
    { phrases: ['Valid phrase', 'Invalid @ phrase'], expectedErrors: ['Phrase 2: Phrase contains invalid characters'], description: 'array with invalid phrase characters' },
    { phrases: ['Valid phrase', 'A'.repeat(101)], expectedErrors: ['Phrase 2: Phrase must be 100 characters or less'], description: 'array with phrase exceeding length limit' }
  ];

  // Test data for duplicate detection
  const duplicateTests = [
    { phrases: ['Hello world', 'HELLO WORLD'], expectedErrors: ['Phrase 2: Duplicate phrase "HELLO WORLD"'], description: 'duplicate phrases (case insensitive)' },
    { phrases: ['Hello world', '  hello world  '], expectedErrors: ['Phrase 2: Duplicate phrase "hello world"'], description: 'duplicate phrases with different spacing' }
  ];

  describe('valid phrase arrays', () => {
    it.each(validPhraseArrays)('should accept $description', ({ phrases }) => {
      const result = validatePhrases(phrases);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject phrases with same content but different casing (duplicates)', () => {
      const result = validatePhrases(['Hello World', 'HELLO world', 'hello WORLD']);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Duplicate phrase'))).toBe(true);
    });
  });

  describe('input validation errors', () => {
    it.each(inputValidationErrors)('should reject $description', ({ phrases, expectedError }) => {
      const result = validatePhrases(phrases as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expectedError);
    });
  });

  describe('individual phrase errors', () => {
    it.each(phraseErrors)('should reject $description', ({ phrases, expectedErrors }) => {
      const result = validatePhrases(phrases as any);
      expect(result.isValid).toBe(false);
      expectedErrors.forEach(expectedError => {
        expect(result.errors).toContain(expectedError);
      });
    });
  });

  describe('duplicate detection', () => {
    it.each(duplicateTests)('should detect $description', ({ phrases, expectedErrors }) => {
      const result = validatePhrases(phrases);
      expect(result.isValid).toBe(false);
      expectedErrors.forEach(expectedError => {
        expect(result.errors).toContain(expectedError);
      });
    });

    it('should handle complex duplicate detection scenario', () => {
      const result = validatePhrases([
        'First phrase',
        'Second phrase',
        'FIRST PHRASE', // Duplicate of first
        'Third phrase',
        '  second phrase  ' // Duplicate of second with extra spaces
      ]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Phrase 3: Duplicate phrase "FIRST PHRASE"');
      expect(result.errors).toContain('Phrase 5: Duplicate phrase "second phrase"');
    });
  });

  describe('complex scenarios', () => {
    it('should report multiple errors for multiple invalid phrases', () => {
      const result = validatePhrases([
        'Valid phrase',
        '', // Empty
        'Invalid @ phrase', // Invalid characters
        'A'.repeat(101), // Too long
        'Valid phrase' // Duplicate
      ]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors).toContain('Phrase 2: Phrase is required');
      expect(result.errors).toContain('Phrase 3: Phrase contains invalid characters');
      expect(result.errors).toContain('Phrase 4: Phrase must be 100 characters or less');
      expect(result.errors).toContain('Phrase 5: Duplicate phrase "Valid phrase"');
    });

    it('should handle array with mixed valid and invalid phrases in sequence', () => {
      const result = validatePhrases([
        'Valid one',
        null as any,
        'Valid two',
        undefined as any,
        'Valid three',
        ''
      ]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors).toContain('Phrase 2: Phrase is required');
      expect(result.errors).toContain('Phrase 4: Phrase is required');
      expect(result.errors).toContain('Phrase 6: Phrase is required');
    });
  });

  describe('edge cases', () => {
    it('should handle array with single space phrase', () => {
      const result = validatePhrases([' ']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phrase 1: Phrase cannot be empty');
    });

    it('should handle large number of phrases', () => {
      const phrases = Array.from({ length: 50 }, (_, i) => `Phrase ${i + 1}`);
      const result = validatePhrases(phrases);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle phrases at exactly 100 characters', () => {
      const exactLength = 'A'.repeat(99) + 'B'; // Exactly 100 chars
      const result = validatePhrases([exactLength]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
