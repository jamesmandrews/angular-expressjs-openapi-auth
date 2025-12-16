/**
 * Test setup and global configuration
 * Runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use different port for tests
process.env.AUTH_PROVIDER = 'stub'; // Use stub auth for most tests

// Suppress logs during tests (optional)
if (!process.env.DEBUG_TESTS) {
  // Mock console methods to reduce noise
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Global test timeout
jest.setTimeout(10000);
