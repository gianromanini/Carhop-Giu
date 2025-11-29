import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const vehicles = pgTable("vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  image: text("image").notNull(),
  pricePerDay: real("price_per_day").notNull(),
  payNowPrice: real("pay_now_price").notNull(),
  mpg: integer("mpg").notNull(),
  passengers: integer("passengers").notNull(),
  transmission: text("transmission").notNull(),
  drivetrain: text("drivetrain").notNull(),
  luggage: integer("luggage").notNull(),
  fuelEfficient: boolean("fuel_efficient").notNull().default(false),
  available: boolean("available").notNull().default(true),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  licenseNumber: text("license_number").notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const reservations = pgTable("reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confirmationNumber: text("confirmation_number").notNull().unique(),
  vehicleId: varchar("vehicle_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  location: text("location").notNull(),
  pickupDate: timestamp("pickup_date").notNull(),
  returnDate: timestamp("return_date").notNull(),
  paymentOption: text("payment_option").notNull(),
  insurance: boolean("insurance").notNull().default(false),
  cleaningFee: boolean("cleaning_fee").notNull().default(false),
  childSeat: boolean("child_seat").notNull().default(false),
  totalPrice: real("total_price").notNull(),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  createdAt: true,
});

export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;

export const priceMatches = pgTable("price_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerEmail: text("customer_email").notNull(),
  competitorName: text("competitor_name").notNull(),
  competitorPrice: real("competitor_price").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  pickupDate: timestamp("pickup_date").notNull(),
  returnDate: timestamp("return_date").notNull(),
  proofUrl: text("proof_url"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPriceMatchSchema = createInsertSchema(priceMatches).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type InsertPriceMatch = z.infer<typeof insertPriceMatchSchema>;
export type PriceMatch = typeof priceMatches.$inferSelect;

export const drivetrainEnum = z.enum(["FWD", "RWD", "AWD"]);
export const transmissionEnum = z.enum(["Automatic", "Manual"]);
export const paymentOptionEnum = z.enum(["now", "later"]);
export const reservationStatusEnum = z.enum(["confirmed", "cancelled", "completed"]);
export const priceMatchStatusEnum = z.enum(["pending", "approved", "rejected"]);
