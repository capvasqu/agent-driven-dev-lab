import { loadConfig } from './config.js';
import { buildServer } from './server.js';

// Entry point (TASK-012). Load config, build the server, and listen.
// All listening lives here; `buildServer()` stays bind-free for testability.

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildServer(config);

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
