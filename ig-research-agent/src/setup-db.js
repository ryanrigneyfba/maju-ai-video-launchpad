#!/usr/bin/env node

// Initialize the SQLite database with schema
// Usage: npm run setup-db

const db = require('./db');

console.log('Initializing IG Research Agent database...');
db.getDb();
console.log('Database created at:', require('./config').dbPath);
console.log('Schema initialized successfully.');
