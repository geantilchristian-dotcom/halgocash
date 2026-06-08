import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    logger.info("Running database migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        phone VARCHAR(20),
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS draws (
        id SERIAL PRIMARY KEY,
        draw_number INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'upcoming',
        jackpot_amount DECIMAL(12,2) NOT NULL,
        prize_pool DECIMAL(12,2) NOT NULL DEFAULT 0,
        winning_ticket_code TEXT,
        winning_numbers JSON,
        scheduled_at TIMESTAMP NOT NULL,
        drawn_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'available',
        price DECIMAL(10,2) NOT NULL,
        series VARCHAR(10) NOT NULL,
        draw_id INTEGER,
        is_winner BOOLEAN NOT NULL DEFAULT FALSE,
        prize_amount DECIMAL(12,2),
        vendor_id INTEGER,
        sold_at TIMESTAMP,
        validated_at TIMESTAMP,
        claimed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'player',
        vendor_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        ticket_id INTEGER,
        ticket_code VARCHAR(20),
        vendor_id INTEGER,
        draw_id INTEGER,
        amount DECIMAL(12,2) NOT NULL,
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire)
    `);

    logger.info("Database migrations completed successfully");
  } finally {
    client.release();
  }
}
