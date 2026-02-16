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
  city: varchar("city"),
  state: varchar("state"),
  passwordHash: varchar("password_hash"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  isHost: boolean("is_host").default(false),
  pickupLocations: text("pickup_locations").array().default([]),
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
  year: integer("year"),
  vinNumber: text("vin_number"),
  licensePlate: text("license_plate"),
  hostName: text("host_name"),
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
  hostId: varchar("host_id"),
  commission: integer("commission").default(10),
  deductible: integer("deductible").default(1000),
  availableLocations: text("available_locations").array().default([]),
  deliveryAddress: text("delivery_address").default(''),
  isDeliveryEnabled: boolean("is_delivery_enabled").default(false),
  maxDeliveryDistance: integer("max_delivery_distance").default(50),
  minDeliveryFeeMiles: integer("min_delivery_fee_miles").default(5),
  minDeliveryFee: real("min_delivery_fee").default(15),
  deliveryPricePerMile: real("delivery_price_per_mile").default(2.50),
  minDeliveryHours: integer("min_delivery_hours").default(6),
  pickupInstructions: text("pickup_instructions").default(''),
  locationLat: real("location_lat"),
  locationLon: real("location_lon"),
  pricing: jsonb("pricing").$type<{
    taxes: number;
    cleaningFee: number;
    includedMiles: number;
    extraMileRate: number;
    prices: { 
      insurance500: number; 
      insurance1000: number; 
      childSeat: number; 
      childSeatPerTrip: boolean;
      prepaidFuel: number; 
      prepaidFuelPerTrip: boolean;
      lateReturnGrace: number; 
      lateReturnGracePerTrip: boolean;
      stressFreePackage: number; 
      stressFreePackagePerTrip: boolean;
    };
  }>(),
  expenses: jsonb("expenses").$type<{
    lease: number;
    insurance: number;
    carWash: number;
    maintenance: number;
    trackApp: number;
    downPayment: number;
  }>(),
  transferRequests: jsonb("transfer_requests").$type<{
    id: string;
    fromHostId: string;
    fromHostName: string;
    toHostId: string;
    toHostName: string;
    requestedBy: string;
    status: 'pending' | 'approved' | 'declined';
    createdAt: string;
    respondedAt?: string;
  }[]>().default([]),
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
    cardName?: string;
    cardNumber?: string;
    expiry?: string;
    cvc?: string;
    type: string;
  }>(),
  paymentMethod: text("payment_method"),
  details: jsonb("details").$type<{
    rate: number;
    extras: number;
    childSeatSelected?: boolean;
    protection: number;
    protectionType?: string;
    fees: number;
    tax: number;
    discount?: number;
    extendedRate?: number;
    manualCharges?: { type: string; amount: number }[];
    deliveryFee?: number;
    deliveryType?: 'delivery' | 'pickup';
    deliveryApprovalStatus?: 'pending' | 'approved' | 'rejected';
    deliveryApprovalMessage?: string;
    deliveryAddress?: string;
    pickupAddress?: string;
    hostEmail?: string;
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
  hostCheckInData: jsonb("host_check_in_data").$type<{
    miles: string;
    gas: string;
    photosOutside: string[];
    photosInside: string[];
  }>(),
  hostCheckOutData: jsonb("host_check_out_data").$type<{
    miles: string;
    gas: string;
    photosOutside: string[];
    photosInside: string[];
  }>(),
  hostCheckInStatus: text("host_check_in_status").notNull().default('pending'),
  hostCheckOutStatus: text("host_check_out_status").notNull().default('pending'),
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
    sender: 'client' | 'admin' | 'host';
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
  vehicleReplaceRequests: jsonb("vehicle_replace_requests").$type<{
    id: string;
    requestedBy: 'client' | 'host' | 'admin';
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    newVehicleId?: number;
    newVehicleModel?: string;
    newDailyRate?: number;
    oldVehicleId: number;
    oldVehicleModel: string;
    oldDailyRate: number;
    priceDifference?: number;
    remainingDays?: number;
    createdAt: string;
    respondedAt?: string;
    respondedBy?: string;
  }[]>().default([]),
  unread: boolean("unread").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hosts = pgTable("hosts", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull().unique(),
  phone: varchar("phone").notNull(),
  address: varchar("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  licenseNumber: varchar("license_number").notNull(),
  licenseFrontImage: text("license_front_image"),
  licenseBackImage: text("license_back_image"),
  proofOfResidenceImage: text("proof_of_residence_image").notNull(),
  socialSecurityNumber: varchar("social_security_number"),
  username: varchar("username").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  agreementAccepted: boolean("agreement_accepted").notNull().default(false),
  agreementAcceptedAt: timestamp("agreement_accepted_at"),
  status: varchar("status").notNull().default('active'),
  pickupLocations: text("pickup_locations").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertHostSchema = createInsertSchema(hosts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHost = z.infer<typeof insertHostSchema>;
export type Host = typeof hosts.$inferSelect;

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
});

export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  vehicleId: integer("vehicle_id").notNull(),
  clientName: varchar("client_name").notNull(),
  clientEmail: varchar("client_email").notNull(),
  hostId: varchar("host_id"),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  hostResponse: text("host_response"),
  hostResponseAt: timestamp("host_response_at"),
  hostStarsToClient: integer("host_stars_to_client"),
  hostCommentToClient: text("host_comment_to_client"),
  hostRatedClientAt: timestamp("host_rated_client_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });

export const insertRatingSchema = createInsertSchema(ratings).omit({ id: true, createdAt: true, hostResponseAt: true });

// Support Messages table for Chat Support
export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  senderType: varchar("sender_type").notNull(), // 'client' | 'host'
  senderId: varchar("sender_id").notNull(), // userId (UUID) for clients, hostId (numeric string) for hosts
  senderName: varchar("sender_name").notNull(),
  senderIdentifier: varchar("sender_identifier").notNull(), // email for clients, @username for hosts
  senderEmail: varchar("sender_email"), // email for hosts (used for display)
  subject: varchar("subject").notNull().default('Duvidas'),
  text: text("text").notNull(),
  images: text("images").array().default([]),
  read: boolean("read").default(false),
  adminReply: text("admin_reply"),
  adminRepliedAt: timestamp("admin_replied_at"),
  isFinished: boolean("is_finished").default(false),
  finishedBy: varchar("finished_by"), // 'client' | 'host' | 'admin'
  finishedAt: timestamp("finished_at"),
  chatStartedAt: timestamp("chat_started_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({ id: true, createdAt: true, adminRepliedAt: true, finishedAt: true, chatStartedAt: true });
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;
export type SupportMessage = typeof supportMessages.$inferSelect;

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;
