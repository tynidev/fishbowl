// Test setup file for backend
// This file is executed before each test file

// Mock console methods to reduce noise in test output
const originalConsole = console;

beforeAll(() => {
  // Suppress console.log, console.warn, etc. during tests unless VERBOSE is set
  if (!process.env.VERBOSE) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  if (!process.env.VERBOSE) {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  }
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ':memory:'; // Use in-memory SQLite for tests
