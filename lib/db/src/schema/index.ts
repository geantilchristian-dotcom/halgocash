import { pgTable, serial, text, decimal, integer, timestamp, varchar, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  phone: varchar("phone", { length: 20 }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const drawsTable = pgTable("draws", {
  id: serial("id").primaryKey(),
  drawNumber: integer("draw_number").notNull().unique(),
  status: text("status").notNull().default("upcoming"),
  jackpotAmount: decimal("jackpot_amount", { precision: 12, scale: 2 }).notNull(),
  prizePool: decimal("prize_pool", { precision: 12, scale: 2 }).notNull().default("0"),
  winningTicketCode: text("winning_ticket_code"),
  winningNumbers: json("winning_numbers").$type<number[]>(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  drawnAt: timestamp("drawn_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  status: text("status").notNull().default("available"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  series: varchar("series", { length: 10 }).notNull(),
  drawId: integer("draw_id"),
  isWinner: boolean("is_winner").notNull().default(false),
  prizeAmount: decimal("prize_amount", { precision: 12, scale: 2 }),
  vendorId: integer("vendor_id"),
  receivedByVendorAt: timestamp("received_by_vendor_at"),
  registeredByClerkId: varchar("registered_by_clerk_id", { length: 255 }),
  registeredAt: timestamp("registered_at"),
  soldAt: timestamp("sold_at"),
  validatedAt: timestamp("validated_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("player"),
  vendorId: integer("vendor_id"),
  isSuspended: boolean("is_suspended").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: varchar("last_login_ip", { length: 45 }),
  plainPassword: text("plain_password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  ticketId: integer("ticket_id"),
  ticketCode: varchar("ticket_code", { length: 20 }),
  vendorId: integer("vendor_id"),
  drawId: integer("draw_id"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  clerkName: text("clerk_name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: text("status").notNull().default("pending"),
  paidByVendorId: integer("paid_by_vendor_id"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  clientPostNom: text("client_post_nom"),
  clientPhone: text("client_phone"),
  clientAge: text("client_age"),
  clientAddress: text("client_address"),
});

export type Withdrawal = typeof withdrawalsTable.$inferSelect;

export const bannersTable = pgTable("banners", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default("image/png"),
  imageData: text("image_data").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Banner = typeof bannersTable.$inferSelect;

export const siteSettingsTable = pgTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const playerProfilesTable = pgTable("player_profiles", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  referralCode: varchar("referral_code", { length: 20 }).notNull().unique(),
  referredByCode: varchar("referred_by_code", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creditAdjustmentsTable = pgTable("credit_adjustments", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  refId: text("ref_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kycTable = pgTable("kyc_submissions", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  fullName: text("full_name").notNull(),
  birthDate: varchar("birth_date", { length: 10 }).notNull(),
  idType: varchar("id_type", { length: 20 }).notNull().default("cni"),
  idNumber: varchar("id_number", { length: 50 }).notNull(),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const fcmTokensTable = pgTable("fcm_tokens", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  token: text("token").notNull().unique(),
  platform: varchar("platform", { length: 20 }).notNull().default("web"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  clerkName: text("clerk_name").notNull().default("Joueur"),
  message: text("message").notNull(),
  fromAdmin: boolean("from_admin").notNull().default(false),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const crashBetsTable = pgTable("crash_bets", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  roundId: integer("round_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("placed"),
  cashoutMult: decimal("cashout_mult", { precision: 8, scale: 2 }),
  wonAmount: integer("won_amount"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sportMatchesTable = pgTable("sport_matches", {
  id: serial("id").primaryKey(),
  fixtureId: integer("fixture_id").notNull().unique(),
  competition: varchar("competition", { length: 10 }).notNull(),
  competitionName: text("competition_name").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeTeamCrest: text("home_team_crest"),
  awayTeamCrest: text("away_team_crest"),
  matchDate: timestamp("match_date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("SCHEDULED"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  oddsHome: decimal("odds_home", { precision: 5, scale: 2 }).notNull().default("2.00"),
  oddsDraw: decimal("odds_draw", { precision: 5, scale: 2 }).notNull().default("3.20"),
  oddsAway: decimal("odds_away", { precision: 5, scale: 2 }).notNull().default("3.50"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

export const sportBetsTable = pgTable("sport_bets", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  matchId: integer("match_id").notNull(),
  fixtureId: integer("fixture_id").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  matchDate: timestamp("match_date").notNull(),
  betType: varchar("bet_type", { length: 10 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  odds: decimal("odds", { precision: 5, scale: 2 }).notNull(),
  potentialWin: decimal("potential_win", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SportMatch = typeof sportMatchesTable.$inferSelect;
export type SportBet = typeof sportBetsTable.$inferSelect;

export const playerModerationTable = pgTable("player_moderation", {
  clerkId: varchar("clerk_id", { length: 255 }).primaryKey(),
  status: text("status").notNull().default("active"),
  blockedEmail: text("blocked_email"),
  blockedIp: text("blocked_ip"),
  warnCount: integer("warn_count").notNull().default(0),
  adminNotes: text("admin_notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PlayerModeration = typeof playerModerationTable.$inferSelect;

export const minesGamesTable = pgTable("mines_games", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  betAmount: integer("bet_amount").notNull(),
  mineCount: integer("mine_count").notNull(),
  minePositions: json("mine_positions").$type<number[]>().notNull(),
  revealedCells: json("revealed_cells").$type<number[]>().notNull().$default(() => []),
  status: text("status").notNull().default("active"),
  cashoutAmount: integer("cashout_amount"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export type MinesGame = typeof minesGamesTable.$inferSelect;

export const maletteGamesTable = pgTable("malette_games", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull(),
  betAmount: integer("bet_amount").notNull(),
  prizePositions: json("prize_positions").$type<number[]>().notNull(),
  chosenIndex: integer("chosen_index"),
  wonMult: decimal("won_mult", { precision: 5, scale: 2 }),
  wonAmount: integer("won_amount"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export type MaletteGame = typeof maletteGamesTable.$inferSelect;

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true });
export const insertDrawSchema = createInsertSchema(drawsTable).omit({ id: true, createdAt: true, drawnAt: true, winningTicketCode: true, winningNumbers: true, prizePool: true });
export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, passwordHash: true });

export type Vendor = typeof vendorsTable.$inferSelect;
export type Draw = typeof drawsTable.$inferSelect;
export type Ticket = typeof ticketsTable.$inferSelect;
export type Transaction = typeof transactionsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type InsertDraw = z.infer<typeof insertDrawSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
