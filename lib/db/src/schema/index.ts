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
});

export type Withdrawal = typeof withdrawalsTable.$inferSelect;

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
