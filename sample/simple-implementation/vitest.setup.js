// Setup file for vitest tests
// Set test environment variables before any tests run
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '3600';
export {};
