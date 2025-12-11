import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  passwordHash: varchar("password_hash"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  model: text("model").notNull(),
  category: text("category").notNull(),
  price: real("price").notNull(),
  fuel: text("fuel").notNull().default('Gasoline'),
  seats: integer("seats").notNull().default(5),
  transmission: text("transmission").notNull().default('Automatic'),
  driveType: text("drive_type").notNull().default('AWD'),
  images: text("images").array().notNull().default([]),
  consumption: text("consumption"),
  isPriceMatch: boolean("is_price_match").default(false),
  isAWD: boolean("is_awd").default(false),
  hasCarPlay: boolean("has_carplay").default(false),
  hasBluetooth: boolean("has_bluetooth").default(false),
  hasReverseCamera: boolean("has_reverse_camera").default(false),
  hasHeatedSeats: boolean("has_heated_seats").default(false),
  hasHeatedSteering: boolean("has_heated_steering").default(false),
  hasElectricSeats: boolean("has_electric_seats").default(false),
  hasPaddleShifters: boolean("has_paddle_shifters").default(false),
  hasKeylessEntry: boolean("has_keyless_entry").default(false),
  hasBlindSpotWarning: boolean("has_blind_spot_warning").default(false),
  hasDriveAssist: boolean("has_drive_assist").default(false),
  hasUSBCharger: boolean("has_usb_charger").default(false),
  expenses: jsonb("expenses").$type<{
    lease: number;
    insurance: number;
    carWash: number;
    maintenance: number;
    trackApp: number;
    downPayment: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  bookingCode: text("booking_code").notNull().unique(),
  date: text("date").notNull(),
  status: text("status").notNull().default('Active'),
  carName: text("car_name").notNull(),
  vehicleId: integer("vehicle_id"),
  location: text("location").notNull(),
  startDate: text("start_date").notNull(),
  startTime: text("start_time").notNull(),
  returnDate: text("return_date").notNull(),
  returnTime: text("return_time").notNull(),
  days: integer("days").notNull(),
  total: real("total").notNull(),
  image: text("image"),
  driver: jsonb("driver").$type<{
    name: string;
    phone: string;
    email: string;
    licenseNumber: string;
    licenseImages: string[];
  }>().notNull(),
  paymentRaw: jsonb("payment_raw").$type<{
    cardName: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
    type: string;
  }>(),
  paymentMethod: text("payment_method"),
  details: jsonb("details").$type<{
    rate: number;
    extras: number;
    protection: number;
    fees: number;
    tax: number;
    discount?: number;
    extendedRate?: number;
    manualCharges?: { type: string; amount: number }[];
  }>().notNull(),
  carRentalAgreement: jsonb("car_rental_agreement").$type<{
    accepted: boolean;
    clientName: string;
    acceptedAt: string;
  }>(),
  checkInStatus: text("check_in_status").notNull().default('pending'),
  checkOutStatus: text("check_out_status").notNull().default('pending'),
  checkInData: jsonb("check_in_data").$type<{
    miles: string;
    gas: string;
    photosOutside: string[];
    photosInside: string[];
  }>(),
  checkOutData: jsonb("check_out_data").$type<{
    miles: string;
    gas: string;
    photosOutside: string[];
    photosInside: string[];
  }>(),
  extensionRequests: jsonb("extension_requests").$type<{
    id: string;
    type: 'extension' | 'reduction';
    requestedReturnDate: string;
    requestedReturnTime: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    respondedAt?: string;
  }[]>().default([]),
  messages: jsonb("messages").$type<{
    id: string;
    sender: 'client' | 'admin';
    text: string;
    createdAt: string;
    read: boolean;
  }[]>().default([]),
  extraPayments: jsonb("extra_payments").$type<{
    id: string;
    type: string;
    amount: number;
    description: string;
    paymentMethod: string;
    processedAt: string;
    status: 'pending' | 'completed' | 'failed';
  }[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
