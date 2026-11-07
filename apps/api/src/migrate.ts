import { resolveConfig } from './config.js';
import { openDb } from './db.js';

const config = resolveConfig();
const db = openDb(config.dbPath);
db.close();
console.log(`migrations applied for ${config.dbPath}`);
