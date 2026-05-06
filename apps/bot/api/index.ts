// Vercel serverless entry point. Exports the wired Express app so Vercel's
// Node.js runtime can wrap it as a serverless function.
export { app as default } from '../src/app.js';
