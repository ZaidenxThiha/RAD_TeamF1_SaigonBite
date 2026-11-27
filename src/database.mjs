import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

export const databasePath = resolve(process.env.SAIGONBITE_DB ?? 'runtime/saigonbite.sqlite');

export function openDatabase(filename = databasePath) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
    try {
      const { user_version: version } = db.prepare('PRAGMA user_version').get();
      if (version === 0) {
        db.exec(schema);
        db.exec(seed);
        db.exec('PRAGMA user_version = 1;');
      } else if (version !== 1) {
        throw new Error('Unsupported SaigonBite schema version.');
      }
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw error;
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
