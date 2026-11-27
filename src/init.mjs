import { databasePath, openDatabase } from './database.mjs';

openDatabase().close();
console.log(`SaigonBite database ready at ${databasePath}`);
