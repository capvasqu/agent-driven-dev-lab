// task-mcp stdio entrypoint (Stage 3). Opens the shared SQLite database, builds
// the MCP server (src/mcp/server.ts), and serves it over stdio. Keep stdout clean
// — it is the MCP protocol channel.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from '../config.js';
import { openDatabase } from '../db/connection.js';
import { createSchema } from '../db/schema.js';
import { TaskRepository } from '../repository/taskRepository.js';
import { buildMcpServer } from './server.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);
createSchema(db);
const repository = new TaskRepository(db);

const server = buildMcpServer(repository);
const transport = new StdioServerTransport();
await server.connect(transport);
