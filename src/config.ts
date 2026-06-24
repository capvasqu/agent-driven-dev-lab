// Configuration loader (spec §1, SA-6). Reads PORT, HOST, DB_PATH from the
// environment with safe local defaults. No secrets here.

export interface Config {
  port: number;
  host: string;
  dbPath: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_DB_PATH = './data/tasks.db';

/** Build the typed config object from `process.env`, applying defaults. */
export function loadConfig(): Config {
  const rawPort = process.env.PORT;
  const parsedPort = rawPort === undefined ? DEFAULT_PORT : Number.parseInt(rawPort, 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

  const host = process.env.HOST && process.env.HOST.trim() !== '' ? process.env.HOST : DEFAULT_HOST;
  const dbPath =
    process.env.DB_PATH && process.env.DB_PATH.trim() !== '' ? process.env.DB_PATH : DEFAULT_DB_PATH;

  return { port, host, dbPath };
}
