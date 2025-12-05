/**
 * Vercel Serverless Function Entry Point
 *
 * This file adapts the Express application to run as a Vercel serverless function.
 * It imports the Express app created by createApp() and exports it in a format
 * that Vercel can handle.
 *
 * Note: This loads the compiled JavaScript from ../dist/backend/app.js
 * The build process must compile TypeScript before deployment.
 */

// Import the compiled Express app factory
// Note: Vercel will look for the compiled version in dist/backend/
const { createApp } = require('../dist/backend/app');

// Create the Express app instance
const app = createApp();

// Export for Vercel serverless functions
// Vercel expects either:
// 1. module.exports = app (for Express apps)
// 2. export default app (for ES modules)
module.exports = app;
