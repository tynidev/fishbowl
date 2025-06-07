// Basic test to verify Jest setup for backend
import { initializeTestDatabase } from '../src/db/init';

describe('Backend Test Setup', () => {
  beforeAll(async () => {
    // Initialize test database before running any tests
    await initializeTestDatabase();
  });

  afterAll(async () => {
    // Clean up database connections
    const { cleanup } = await import('../src/db');
    await cleanup();
  });

  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should have access to test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DATABASE_URL).toBe(':memory:');
  });

  it('should be able to use async/await', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
