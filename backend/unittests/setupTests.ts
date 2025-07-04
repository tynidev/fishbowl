// Test setup file for backend
// This file is executed before each test file

import { Application } from "express";
import { initializeTestDatabase } from "../src/db/init";
import { resetAllMocks, setupTestApp } from "./test-helpers/test-helpers";

let app: Application;

// Mock console methods to reduce noise in test output
const originalConsole = {
  log: console.log,
  warn: console.warn,
  info: console.info,
  error: console.error,
  debug: console.debug,
  trace: console.trace
};

beforeAll(async () => {
  // Suppress console output during tests unless VERBOSE is set
  if (!process.env.VERBOSE) {
    // Replace with silent mock functions
    console.log = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
    console.trace = jest.fn();
    
    // Keep console.error for actual test failures, but you can uncomment to suppress it too
    console.error = jest.fn();
  }

  // Initialize test database
  await initializeTestDatabase();
  app = setupTestApp();
});

afterAll(() => {
  // Restore console methods
  if (!process.env.VERBOSE) {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    console.trace = originalConsole.trace;
    console.error = originalConsole.error;
  }
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ':memory:'; // Use in-memory SQLite for tests

export { app }; // Export the app for use in tests