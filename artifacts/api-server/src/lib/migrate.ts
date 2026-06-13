import { pool } from "@workspace/db";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
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

    // Add new columns to users table (idempotent)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT`);

    // Add coupon registration columns to tickets table (idempotent)
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS registered_by_clerk_id VARCHAR(255)`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP`);
    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS received_by_vendor_at TIMESTAMP`);

    // Withdrawals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL,
        clerk_name TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        token VARCHAR(64) NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        paid_by_vendor_id INTEGER,
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Banners table
    await client.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'image/png',
        image_data TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Site settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Player profiles (referral system)
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_profiles (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL UNIQUE,
        referral_code VARCHAR(20) NOT NULL UNIQUE,
        referred_by_code VARCHAR(20),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Credit adjustments (manual balance credits / bonus)
    await client.query(`
      CREATE TABLE IF NOT EXISTS credit_adjustments (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        reason TEXT NOT NULL,
        ref_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // KYC identity submissions
    await client.query(`
      CREATE TABLE IF NOT EXISTS kyc_submissions (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        birth_date VARCHAR(10) NOT NULL,
        id_type VARCHAR(20) NOT NULL DEFAULT 'cni',
        id_number VARCHAR(50) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMP
      )
    `);

    // FCM push notification tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL,
        token TEXT NOT NULL UNIQUE,
        platform VARCHAR(20) NOT NULL DEFAULT 'web',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Support chat messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        clerk_id VARCHAR(255) NOT NULL,
        clerk_name TEXT NOT NULL DEFAULT 'Joueur',
        message TEXT NOT NULL,
        from_admin BOOLEAN NOT NULL DEFAULT FALSE,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Sport matches (football API cache)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sport_matches (
        id SERIAL PRIMARY KEY,
        fixture_id INTEGER NOT NULL UNIQUE,
        competition VARCHAR(10) NOT NULL,
        competition_name TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        home_team_crest TEXT,
        away_team_crest TEXT,
        match_date TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
        home_score INTEGER,
        away_score INTEGER,
        odds_home DECIMAL(5,2) NOT NULL DEFAULT 2.00,
        odds_draw DECIMAL(5,2) NOT NULL DEFAULT 3.20,
        odds_away DECIMAL(5,2) NOT NULL DEFAULT 3.50,
        fetched_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Sport bets placed by players
    await client.query(`
      CREATE TABLE IF NOT EXISTS sport_bets (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL,
        match_id INTEGER NOT NULL,
        fixture_id INTEGER NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        match_date TIMESTAMP NOT NULL,
        bet_type VARCHAR(10) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        odds DECIMAL(5,2) NOT NULL,
        potential_win DECIMAL(12,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        settled_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Game cover images (stored in DB by admin)
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_covers (
        id SERIAL PRIMARY KEY,
        game_key VARCHAR(50) NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'image/png',
        image_data TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Jackpot poster image
    await client.query(`
      CREATE TABLE IF NOT EXISTS jackpot_poster (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'image/png',
        image_data TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Crash game bets
    await client.query(`
      CREATE TABLE IF NOT EXISTS crash_bets (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL,
        round_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'placed',
        cashout_mult DECIMAL(8,2),
        won_amount INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Player moderation records
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_moderation (
        clerk_id VARCHAR(255) PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active',
        blocked_email TEXT,
        blocked_ip TEXT,
        warn_count INTEGER NOT NULL DEFAULT 0,
        admin_notes TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Mines game sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS mines_games (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL,
        bet_amount INTEGER NOT NULL,
        mine_count INTEGER NOT NULL,
        mine_positions JSON NOT NULL,
        revealed_cells JSON NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        cashout_amount INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP
      )
    `);

    // Malette Secrète game sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS malette_games (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) NOT NULL,
        bet_amount INTEGER NOT NULL,
        prize_positions JSON NOT NULL,
        chosen_index INTEGER,
        won_mult DECIMAL(5,2),
        won_amount INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `);

    // ── Round-based Malette (new model) ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS malette_rounds (
        id              SERIAL PRIMARY KEY,
        status          TEXT NOT NULL DEFAULT 'betting',
        multipliers     JSON,
        bets_per_case   JSON,
        total_collected DECIMAL(14,2),
        total_paid      DECIMAL(14,2),
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        closes_at       TIMESTAMP NOT NULL,
        closed_at       TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS malette_bets (
        id          SERIAL PRIMARY KEY,
        round_id    INTEGER NOT NULL,
        clerk_id    VARCHAR(255) NOT NULL,
        case_index  INTEGER NOT NULL,
        amount      DECIMAL(14,2) NOT NULL,
        multiplier  DECIMAL(5,2),
        payout      DECIMAL(14,2),
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_malette_bets_round ON malette_bets (round_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_malette_bets_clerk ON malette_bets (round_id, clerk_id)
    `);

    // ── withdrawals — colonnes client ajoutées après la création initiale ────
    await client.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS client_post_nom TEXT`);
    await client.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS client_phone    TEXT`);
    await client.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS client_age      TEXT`);
    await client.query(`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS client_address  TEXT`);

    // ── device_id column (ajout progressif) ─────────────────────────────────
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id TEXT
    `);

    // ── authorized_ip — verrouillage IP par appareil vendeur ─────────────────
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS authorized_ip VARCHAR(45)
    `);

    // ── IP status on users ────────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS ip_status VARCHAR(20)
    `);

    // ── Vendor IP attempts (blocage après 2 tentatives par compte+IP) ──────────
    await client.query(`DROP TABLE IF EXISTS vendor_ip_attempts`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_ip_attempts (
        ip         VARCHAR(45) NOT NULL,
        user_id    INTEGER NOT NULL,
        fail_count INTEGER NOT NULL DEFAULT 0,
        blocked    BOOLEAN NOT NULL DEFAULT FALSE,
        blocked_at TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (ip, user_id)
      )
    `);

    // ── POS Sales (tickets générés par les vendeurs) ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pos_sales (
        id           SERIAL PRIMARY KEY,
        vendor_id    INTEGER NOT NULL,
        unit_amount  DECIMAL(12,2) NOT NULL,
        quantity     INTEGER NOT NULL,
        total_amount DECIMAL(12,2) NOT NULL,
        codes        TEXT[] NOT NULL DEFAULT '{}',
        currency     TEXT NOT NULL DEFAULT 'USD',
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_sales_vendor ON pos_sales (vendor_id)
    `);

    // ── POS Game Tickets (jeux vendeur : malette, sport) ──────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pos_game_tickets (
        id                SERIAL PRIMARY KEY,
        ticket_code       VARCHAR(12) NOT NULL UNIQUE,
        vendor_id         INTEGER NOT NULL,
        vendor_user_id    INTEGER NOT NULL,
        game_type         VARCHAR(20) NOT NULL,
        game_ref_id       INTEGER,
        selection         JSONB,
        home_team         TEXT,
        away_team         TEXT,
        match_date        TIMESTAMP,
        amount_fc         INTEGER NOT NULL,
        potential_payout_fc INTEGER,
        status            VARCHAR(20) NOT NULL DEFAULT 'pending',
        actual_payout_fc  INTEGER,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        settled_at        TIMESTAMP,
        paid_at           TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_game_tickets_vendor ON pos_game_tickets (vendor_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_game_tickets_code ON pos_game_tickets (ticket_code);
    `);

    logger.info("Database migrations completed successfully");
  } finally {
    client.release();
  }
}

export async function seedAdmin() {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .limit(1);

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash("Halgo@2024!", 12);
    await db.insert(usersTable).values({
      email: "admin@halgo.cash",
      username: "admin",
      passwordHash,
      role: "admin",
    });
    logger.info("Compte admin créé — identifiant: admin  mot de passe: Halgo@2024!");
  }
}
