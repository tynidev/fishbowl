# Unit Test Guide for Fishbowl Backend

## Overview

The Fishbowl backend has a comprehensive test suite located in [`backend/unittests`](c:\Users\Tyler.TYLERS-PC\source\repos\fishbowl\backend\unittests). The tests are organized by functionality and use Jest as the testing framework with TypeScript.

## Test Structure

### Directory Organization

```
unittests/
├── setup.test.ts          # Basic setup validation
├── setupTests.ts          # Global test configuration
├── db/                    # Database tests
├── routes/                # REST API endpoint tests  
├── sockets/               # WebSocket tests
├── test-helpers/          # Shared test utilities
└── utils/                 # Utility function tests
```

### Key Test Files

- **`setupTests.ts`**: Global test setup that initializes the test database and Express app
- **`db/database.test.ts`**: Tests database connections, migrations, and basic CRUD operations
- **[`routes/*.test.ts`](c:\Users\Tyler.TYLERS-PC\source\repos\fishbowl\backend\unittests\routes)**: Tests for REST API endpoints (games, players, phrases, config)
- **`utils/validators.test.ts`**: Tests for input validation functions
- **`sockets/SOCKET-API.test.ts`**: WebSocket event handler tests (planned)

## Test Helpers and Factories

### Test Factories (`test-factories.ts`)

Provides factory functions to create test data:

```typescript
// Create games in different states
const waitingGame = gameFactory.waiting();
const playingGame = gameFactory.playing();

// Create players
const player = playerFactory.connected(gameId, teamId, 'Player Name');

// Create teams
const teams = teamFactory.createMultiple(gameId, 3);

// Create complete game setup
const setup = createGameSetup({
  teamCount: 2,
  playersPerTeam: 3,
  phrasesPerPlayer: 5
});
```

### Test Helpers (`test-helpers.ts`)

Provides utilities for test setup:

```typescript
// Create complete game scenario
const scenario = createGameScenario({
  gameCode: 'ABC123',
  teamCount: 2,
  playerCount: 4,
  gameStatus: 'waiting'
});

// Reset mocks between tests
await resetAllMocks();

// Setup Express app for testing
const app = setupTestApp();
```

### Real Database Utils (`realDbUtils.ts`)

Creates an in-memory SQLite database populated with test data:

```typescript
const store = await createRealDataStoreFromScenario(scenario).initDb();
```

## How to Write Tests

### 1. Basic Test Structure

```typescript
import { createGameScenario, resetAllMocks } from '../test-helpers/test-helpers';
import { createRealDataStoreFromScenario } from '../test-helpers/realDbUtils';
import { app } from '../setupTests';

describe('Feature Name', () => {
  beforeEach(async () => {
    await resetAllMocks();
  });

  it('should do something', async () => {
    // Arrange - Create test scenario
    const scenario = createGameScenario({
      gameCode: 'TEST01',
      gameStatus: 'waiting'
    });
    await createRealDataStoreFromScenario(scenario).initDb();

    // Act - Perform the action
    const response = await request(app)
      .get('/api/games/TEST01')
      .expect(200);

    // Assert - Check the results
    expect(response.body).toMatchObject({
      id: 'TEST01',
      status: 'waiting'
    });
  });
});
```

### 2. Testing API Endpoints

```typescript
// Test successful response
const response = await request(app)
  .post('/api/games')
  .send({ name: 'Test Game', hostPlayerName: 'Host' })
  .expect(201);

// Test error cases
const errorResponse = await request(app)
  .put('/api/games/INVALID/config')
  .send({ teamCount: 10 })
  .expect(400);
```

### 3. Testing with Different Game States

```typescript
// Test with game in different states
const scenarios = [
  { status: 'waiting', shouldSucceed: true },
  { status: 'playing', shouldSucceed: false },
  { status: 'finished', shouldSucceed: false }
];

for (const { status, shouldSucceed } of scenarios) {
  it(`should ${shouldSucceed ? 'allow' : 'reject'} when game is ${status}`, async () => {
    const scenario = createGameScenario({ gameStatus: status });
    // ... test logic
  });
}
```

### 4. Testing Validation

```typescript
// Use parameterized tests for validation
const invalidInputs = [
  { input: '', error: 'cannot be empty' },
  { input: 'a'.repeat(21), error: 'exceeds maximum length' },
  { input: 'test@#$', error: 'invalid characters' }
];

it.each(invalidInputs)('should reject $input', ({ input, error }) => {
  const result = validateInput(input);
  expect(result.isValid).toBe(false);
  expect(result.error).toContain(error);
});
```

## Common Test Patterns

### 1. Database State Testing
- Always use `createRealDataStoreFromScenario` for database tests
- The database is automatically reset between tests
- Use factories to create consistent test data

### 2. API Response Testing
- Use `supertest` for HTTP requests
- Check both status codes and response bodies
- Test error cases as thoroughly as success cases

### 3. WebSocket Testing (Planned)
- Use Socket.IO client for testing events
- Test both emission and reception of events
- Verify broadcasts reach correct recipients

## Modifying Tests

### Adding New Tests

1. Create test file in appropriate directory under [`backend/unittests`](c:\Users\Tyler.TYLERS-PC\source\repos\fishbowl\backend\unittests)
2. Import necessary helpers and factories
3. Follow existing patterns for consistency
4. Use descriptive test names

### Updating Existing Tests

1. Run tests before making changes: `npm test`
2. Update test data using factories when possible
3. Ensure tests remain isolated (no dependencies between tests)
4. Update test descriptions if behavior changes

### Best Practices

1. **Use Factories**: Don't hardcode test data
2. **Test Edge Cases**: Empty inputs, boundaries, invalid data
3. **Clear Assertions**: Use specific matchers and clear error messages
4. **Isolate Tests**: Each test should be independent
5. **Mock External Dependencies**: Database is real but in-memory

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
cd backend/unittests && npx jest routes/gameConfig.test.ts

# Run with verbose output
VERBOSE=true npm test
```