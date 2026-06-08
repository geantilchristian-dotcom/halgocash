import { pgTable, serial, text, decimal, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  ownerName: text("owner_name"),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const destinationsTable = pgTable("destinations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  zone: text("zone"),
});

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  accountCode: varchar("account_code", { length: 10 }),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  iconType: text("icon_type"),
  date: timestamp("date").notNull().defaultNow(),
});

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  accountCode: varchar("account_code", { length: 10 }),
  destinationId: integer("destination_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  ticketType: text("ticket_type").notNull().default("Standard"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true });
export const insertDestinationSchema = createInsertSchema(destinationsTable).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });

export type Account = typeof accountsTable.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Destination = typeof destinationsTable.$inferSelect;
export type Transaction = typeof transactionsTable.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
