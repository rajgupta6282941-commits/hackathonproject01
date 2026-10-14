import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './database/connection.js';
import { validateBackendEnvironment } from './config/environment.js';

const port = Number(process.env.PORT ?? 3001);

const environmentErrors = validateBackendEnvironment();
if (environmentErrors.length) {
  console.error(`[vikral-api] Configuration error: ${environmentErrors.join(' ')}`);
  process.exitCode = 1;
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('[vikral-api] PORT must be an integer between 1 and 65535.');
  process.exitCode = 1;
}

const databaseRetryDelayMs = 30_000;

const connectDatabaseInBackground = async (): Promise<void> => {
  try {
    await connectDatabase();
    console.info('[vikral-api] Database connected.');
  } catch (error) {
    console.error('[vikral-api] Database connection failed; retrying in 30 seconds:', error instanceof Error ? error.message : error);
    setTimeout(() => void connectDatabaseInBackground(), databaseRetryDelayMs).unref();
  }
};

const start = () => {
  const server = app.listen(port, '0.0.0.0', () => {
    console.info(`[vikral-api] Listening on port ${port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') console.error(`[vikral-api] Port ${port} is already in use.`);
    else console.error('[vikral-api] Failed to start server:', error);
    process.exitCode = 1;
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.info(`[vikral-api] ${signal} received; shutting down.`);
    server.close((error) => {
      if (error) {
        console.error('[vikral-api] Error while shutting down:', error);
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  void connectDatabaseInBackground();
};

if (process.exitCode !== 1) void start();
