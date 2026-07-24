import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "database.sqlite");

let db;

export async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      first_name TEXT,
      username TEXT,
      balance INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS films (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      price INTEGER DEFAULT 0,
      poster_file_id TEXT,
      video_file_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      film_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      film_id INTEGER NOT NULL,
      order_id INTEGER,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      telegram_id TEXT PRIMARY KEY,
      step TEXT,
      film_data TEXT
    );
  `);
  const orderColumns = [
    ["virtual_account_reference", "TEXT"],
    ["account_number", "TEXT"],
    ["account_name", "TEXT"],
    ["bank_name", "TEXT"],
  ];

  for (const [column, type] of orderColumns) {
    try {
      db.run(`ALTER TABLE orders ADD COLUMN ${column} ${type}`);
    } catch (error) {
      // Column already exists
    }
  }
  saveDatabase();

  console.log("✅ Database initialized successfully");
}
  try {
    db.run(`
      ALTER TABLE orders ADD COLUMN virtual_account_reference TEXT;
    `);
  } catch (error) {}

  try {
    db.run(`
      ALTER TABLE orders ADD COLUMN account_number TEXT;
    `);
  } catch (error) {}

  try {
    db.run(`
      ALTER TABLE orders ADD COLUMN account_name TEXT;
    `);
  } catch (error) {}

  try {
    db.run(`
      ALTER TABLE orders ADD COLUMN bank_name TEXT;
    `);
  } catch (error) {}
export function getDatabase() {
  return db;
}

export function saveDatabase() {
  if (!db) return;

  const data = db.export();
  const buffer = Buffer.from(data);

  fs.writeFileSync(dbPath, buffer);
}