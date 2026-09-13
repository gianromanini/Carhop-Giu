import { 
  vehicles, bookings, settings, hosts, users, ratings, supportMessages, payouts,
  type Vehicle, type InsertVehicle,
  type Booking, type InsertBooking,
  type Settings, type InsertSettings,
  type User, type UpsertUser,
  type Host, type InsertHost,
  type Rating, type InsertRating,
  type SupportMessage, type InsertSupportMessage,
  type Payout, type InsertPayout
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, ilike, or, and, inArray, sql, desc, getTableColumns } from "drizzle-orm";
import pg from "pg";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD_HASH = bcrypt.hashSync("demo123", 10);

export type VehicleSummary = Omit<Vehicle, "images"> & {
  images: string[];
  imagesCount: number;
};

export type BookingFinancialSummary = Pick<
  Booking,
  "status" | "carName" | "startDate" | "total" | "checkInStatus" | "checkOutStatus"
>;

export interface IStorage {
  // Users (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUserTrips(userEmail: string): Promise<Booking[]>;

  // Vehicles
  getVehicles(): Promise<Vehicle[]>;
  getVehicleSummaries(): Promise<VehicleSummary[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  restoreVehicle(id: number, vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<boolean>;

  // Bookings
  getBookings(): Promise<Booking[]>;
  getBookingFinancialSummaries(): Promise<BookingFinancialSummary[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingByCode(code: string): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, booking: Partial<InsertBooking>): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<boolean>;

  // Settings
  getSetting(key: string): Promise<Settings | undefined>;
  setSetting(key: string, value: any): Promise<Settings>;
  getAllSettings(): Promise<Settings[]>;

  // Hosts
  getHosts(): Promise<Host[]>;
  getHost(id: number): Promise<Host | undefined>;
  getHostByUsername(username: string): Promise<Host | undefined>;
  getHostByEmail(email: string): Promise<Host | undefined>;
  createHost(host: InsertHost): Promise<Host>;
  updateHost(id: number, host: Partial<InsertHost>): Promise<Host | undefined>;
  deleteHost(id: number): Promise<boolean>;

  // Ratings
  getRatings(): Promise<Rating[]>;
  getRating(id: number): Promise<Rating | undefined>;
  getRatingsByVehicle(vehicleId: number): Promise<Rating[]>;
  getRatingByBooking(bookingId: number): Promise<Rating | undefined>;
  createRating(rating: InsertRating): Promise<Rating>;
  updateRating(id: number, rating: Partial<InsertRating>): Promise<Rating | undefined>;
  deleteRating(id: number): Promise<boolean>;

  // Support Messages
  getSupportMessages(): Promise<SupportMessage[]>;
  getSupportMessagesByType(senderType: string): Promise<SupportMessage[]>;
  getSupportMessage(id: number): Promise<SupportMessage | undefined>;
  createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage>;
  updateSupportMessage(id: number, message: Partial<InsertSupportMessage>): Promise<SupportMessage | undefined>;
  deleteSupportMessage(id: number): Promise<boolean>;
  finishSupportMessageGroup(senderIdentifier: string, senderType: string, finishedBy: string): Promise<boolean>;
  finishSupportMessageGroupBySubjectAndSender(subject: string, senderId: string, finishedBy: string): Promise<boolean>;
  getUnreadSupportMessagesCount(senderType: string): Promise<number>;

  // Payouts
  getPayoutsByHost(hostId: number): Promise<Payout[]>;
  createPayout(payout: InsertPayout): Promise<Payout>;
}

export class MemStorage implements IStorage {
  private vehicles: Map<number, Vehicle> = new Map();
  private bookings: Map<number, Booking> = new Map();
  private settings: Map<string, Settings> = new Map();
  private users: Map<string, User> = new Map();
  private hosts: Map<number, Host> = new Map();
  private supportMessagesMap: Map<number, SupportMessage> = new Map();
  private passwordResetTokens: Map<string, { email: string; expiresAt: number }> = new Map();
  private emailOTPs: Map<string, { code: string; expiresAt: number; attempts: number }> = new Map();
  private vehicleId = 1;
  private bookingId = 1;
  private settingsId = 1;
  private hostId = 1;
  private supportMessageId = 1;
  private bookingCodeCounter = 1;

  // Email OTP for booking lookup
  generateEmailOTP(email: string): string {
    const normalizedEmail = email.toLowerCase().trim();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    this.emailOTPs.set(normalizedEmail, { code, expiresAt, attempts: 0 });
    return code;
  }

  validateEmailOTP(email: string, code: string): boolean {
    const normalizedEmail = email.toLowerCase().trim();
    const otp = this.emailOTPs.get(normalizedEmail);
    if (!otp || otp.expiresAt < Date.now()) {
      this.emailOTPs.delete(normalizedEmail);
      return false;
    }
    if (otp.attempts >= 5) {
      this.emailOTPs.delete(normalizedEmail);
      return false;
    }
    if (otp.code !== code) {
      otp.attempts++;
      return false;
    }
    this.emailOTPs.delete(normalizedEmail);
    return true;
  }

  // Password reset tokens
  generatePasswordResetToken(email: string): string {
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    this.passwordResetTokens.set(token, { email, expiresAt });
    return token;
  }

  validatePasswordResetToken(token: string): { email: string } | null {
    const reset = this.passwordResetTokens.get(token);
    if (!reset || reset.expiresAt < Date.now()) {
      this.passwordResetTokens.delete(token);
      return null;
    }
    return { email: reset.email };
  }

  invalidatePasswordResetToken(token: string): void {
    this.passwordResetTokens.delete(token);
  }

  // Users (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const users = Array.from(this.users.values());
    for (const user of users) {
      if (user.email?.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const id = crypto.randomUUID();
    const newUser: User = {
      id,
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      phone: userData.phone ?? null,
      city: userData.city ?? null,
      state: userData.state ?? null,
      passwordHash: userData.passwordHash ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      isAdmin: userData.isAdmin ?? false,
      isHost: userData.isHost ?? false,
      pickupLocations: userData.pickupLocations ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id!);
    if (existing) {
      const updated: User = {
        ...existing,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(userData.id!, updated);
      return updated;
    }
    const newUser: User = {
      id: userData.id!,
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      phone: userData.phone ?? null,
      city: userData.city ?? null,
      state: userData.state ?? null,
      passwordHash: userData.passwordHash ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      isAdmin: userData.isAdmin ?? false,
      isHost: userData.isHost ?? false,
      pickupLocations: userData.pickupLocations ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userData.id!, newUser);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: User = {
      ...existing,
      firstName: updates.firstName ?? existing.firstName,
      lastName: updates.lastName ?? existing.lastName,
      phone: updates.phone ?? existing.phone,
      email: updates.email ?? existing.email,
      profileImageUrl: updates.profileImageUrl ?? existing.profileImageUrl,
      passwordHash: updates.passwordHash ?? existing.passwordHash,
      isAdmin: updates.isAdmin ?? existing.isAdmin,
      pickupLocations: updates.pickupLocations ?? existing.pickupLocations,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getUserTrips(userEmail: string): Promise<Booking[]> {
    const allBookings = Array.from(this.bookings.values());
    return allBookings.filter(booking => booking.driver.email?.toLowerCase() === userEmail.toLowerCase());
  }

  private generateBookingCode(): string {
    const code = `BK${String(this.bookingCodeCounter).padStart(4, '0')}`;
    this.bookingCodeCounter++;
    return code;
  }

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default hosts first
    const defaultHosts: InsertHost[] = [
      {
        firstName: 'John',
        lastName: 'Martinez',
        email: 'john.martinez@example.com',
        phone: '(203) 555-0001',
        address: '123 Main St',
        city: 'Stamford',
        state: 'CT',
        zipCode: '06901',
        licenseNumber: 'CT-12345678',
        licenseFrontImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        licenseBackImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        proofOfResidenceImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        socialSecurityNumber: null,
        username: 'johnmartinez',
        passwordHash: DEMO_PASSWORD_HASH,
        agreementAccepted: true,
        agreementAcceptedAt: new Date(),
        status: 'active'
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@example.com',
        phone: '(203) 555-0002',
        address: '456 Oak Ave',
        city: 'Darien',
        state: 'CT',
        zipCode: '06820',
        licenseNumber: 'CT-87654321',
        licenseFrontImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        licenseBackImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        proofOfResidenceImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        socialSecurityNumber: null,
        username: 'sarahjohnson',
        passwordHash: DEMO_PASSWORD_HASH,
        agreementAccepted: true,
        agreementAcceptedAt: new Date(),
        status: 'active'
      },
      {
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'michael.chen@example.com',
        phone: '(203) 555-0003',
        address: '789 Pine Rd',
        city: 'Norwalk',
        state: 'CT',
        zipCode: '06850',
        licenseNumber: 'CT-55555555',
        licenseFrontImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        licenseBackImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        proofOfResidenceImage: 'https://images.unsplash.com/photo-1579274455169-25c00b8e3102?w=300',
        socialSecurityNumber: null,
        username: 'michaelchen',
        passwordHash: DEMO_PASSWORD_HASH,
        agreementAccepted: true,
        agreementAcceptedAt: new Date(),
        status: 'active'
      },
    ];

    const createdHosts: Host[] = [];
    // Use synchronous approach by calling internal method directly
    defaultHosts.forEach(h => {
      const id = this.hostId++;
      const host: Host = {
        id,
        ...h,
        address: h.address ?? null,
        city: h.city ?? null,
        state: h.state ?? null,
        zipCode: h.zipCode ?? null,
        licenseFrontImage: h.licenseFrontImage ?? null,
        licenseBackImage: h.licenseBackImage ?? null,
        proofOfResidenceImage: h.proofOfResidenceImage ?? null,
        socialSecurityNumber: h.socialSecurityNumber ?? null,
        agreementAccepted: h.agreementAccepted ?? false,
        agreementAcceptedAt: h.agreementAcceptedAt ?? null,
        status: h.status ?? 'active',
        pickupLocations: h.pickupLocations ?? [],
        bankAccount: null,
        payoutSettings: null,
        stripeAccountId: null,
        stripeOnboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.hosts.set(id, host);
      createdHosts.push(host);
    });

    const defaultVehicles: InsertVehicle[] = [
      {
        model: 'Hyunday Elantra 2016',
        category: 'Sedan',
        price: 35,
        fuel: 'Gasoline',
        seats: 5,
        transmission: 'Automatic',
        driveType: 'AWD',
        images: ['https://images.unsplash.com/photo-1609687882914-0e222b1fbf20?w=500'],
        consumption: '32 MPG',
        isPriceMatch: true,
        isAWD: true,
        hasCarPlay: true,
        hasBluetooth: true,
        hasReverseCamera: true,
        hasHeatedSeats: true,
        hasHeatedSteering: true,
        hasElectricSeats: true,
        hasPaddleShifters: true,
        hasKeylessEntry: true,
        hasBlindSpotWarning: true,
        hasDriveAssist: true,
        hasUSBCharger: true,
        hostId: createdHosts[0]?.id.toString() ?? '1',
      },
      {
        model: 'Subaru Impreza 2025',
        category: 'Sedan',
        price: 45,
        fuel: 'Gasoline',
        seats: 5,
        transmission: 'Automatic',
        driveType: 'AWD',
        images: ['https://images.unsplash.com/photo-1619405399517-d4b794a133a0?w=500'],
        consumption: '33 MPG',
        isPriceMatch: true,
        isAWD: true,
        hasCarPlay: true,
        hasBluetooth: true,
        hasReverseCamera: true,
        hasHeatedSeats: true,
        hasHeatedSteering: true,
        hasElectricSeats: true,
        hasPaddleShifters: true,
        hasKeylessEntry: true,
        hasBlindSpotWarning: true,
        hasDriveAssist: true,
        hasUSBCharger: true,
        hostId: createdHosts[1]?.id.toString() ?? '2',
      },
      {
        model: 'Nissan Kicks 2026',
        category: 'Hatchback',
        price: 38,
        fuel: 'Gasoline',
        seats: 5,
        transmission: 'Automatic',
        driveType: 'FWD',
        images: ['https://images.unsplash.com/photo-1617654112368-22ec9dbc10a0?w=500'],
        consumption: '34 MPG',
        isPriceMatch: true,
        isAWD: true,
        hasCarPlay: true,
        hasBluetooth: true,
        hasReverseCamera: true,
        hasHeatedSeats: true,
        hasHeatedSteering: true,
        hasElectricSeats: true,
        hasPaddleShifters: true,
        hasKeylessEntry: true,
        hasBlindSpotWarning: true,
        hasDriveAssist: true,
        hasUSBCharger: true,
        hostId: createdHosts[2]?.id.toString() ?? '3',
      },
      {
        model: 'Kia Seltos 2025 EX',
        category: 'SUV',
        price: 52,
        fuel: 'Gasoline',
        seats: 5,
        transmission: 'Automatic',
        driveType: 'AWD',
        images: ['https://images.unsplash.com/photo-1608656415512-92b378bada41?w=500'],
        consumption: '32 MPG',
        isPriceMatch: true,
        isAWD: true,
        hasCarPlay: true,
        hasBluetooth: true,
        hasReverseCamera: true,
        hasHeatedSeats: true,
        hasHeatedSteering: true,
        hasElectricSeats: true,
        hasPaddleShifters: true,
        hasKeylessEntry: true,
        hasBlindSpotWarning: true,
        hasDriveAssist: true,
        hasUSBCharger: true,
        hostId: createdHosts[0]?.id.toString() ?? '1',
      },
      {
        model: 'Ford Escape 2014',
        category: 'SUV',
        price: 40,
        fuel: 'Gasoline',
        seats: 5,
        transmission: 'Automatic',
        driveType: 'AWD',
        images: ['https://images.unsplash.com/photo-1606611013016-969c19d4a42f?w=500'],
        consumption: '28 MPG',
        isPriceMatch: true,
        isAWD: true,
        hasCarPlay: true,
        hasBluetooth: true,
        hasReverseCamera: true,
        hasHeatedSeats: true,
        hasHeatedSteering: true,
        hasElectricSeats: true,
        hasPaddleShifters: true,
        hasKeylessEntry: true,
        hasBlindSpotWarning: true,
        hasDriveAssist: true,
        hasUSBCharger: true,
        hostId: createdHosts[1]?.id.toString() ?? '2',
      },
      {
        model: 'Honda Accord 2024',
        category: 'Sedan',
        price: 48,
        fuel: 'Gasoline',
        seats: 5,
        transmission: 'Automatic',
        driveType: 'FWD',
        images: ['https://images.unsplash.com/photo-1609687882914-0e222b1fbf20?w=500'],
        consumption: '35 MPG',
        isPriceMatch: true,
        isAWD: true,
        hasCarPlay: true,
        hasBluetooth: true,
        hasReverseCamera: true,
        hasHeatedSeats: true,
        hasHeatedSteering: true,
        hasElectricSeats: true,
        hasPaddleShifters: true,
        hasKeylessEntry: true,
        hasBlindSpotWarning: true,
        hasDriveAssist: true,
        hasUSBCharger: true,
        hostId: createdHosts[2]?.id.toString() ?? '3',
      },
    ];

    defaultVehicles.forEach(v => this.createVehicle(v));

    const defaultSettings: { key: string; value: any }[] = [
      { key: 'taxes', value: 8.5 },
      { key: 'cleaningFee', value: 25 },
      { key: 'includedMiles', value: 200 },
      { key: 'extraMileRate', value: 0.45 },
      { key: 'prices', value: { insurance500: 25, insurance1000: 15, childSeat: 8 } },
      { key: 'locations', value: ['JFK Airport', 'Downtown Center', 'Fairfield County'] },
    ];

    defaultSettings.forEach(s => this.setSetting(s.key, s.value));

    const mockBookings: InsertBooking[] = [
      {
        bookingCode: '',
        date: 'Nov 15, 2023',
        status: 'Completed',
        carName: 'Tesla Model 3',
        location: 'JFK Airport Drop-off',
        startDate: '2023-11-15',
        startTime: '10:00 AM',
        returnDate: '2023-11-18',
        returnTime: '10:00 AM',
        days: 3,
        total: 583.50,
        image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=500',
        driver: {
          name: "Carlos Silva",
          phone: "(203) 555-0123",
          email: "carlos.silva@email.com",
          licenseNumber: "CT-99887766",
          licenseImages: []
        },
        paymentRaw: { cardName: "CARLOS SILVA", cardNumber: "4242 4242 4242 4242", expiry: "12/28", cvc: "123", type: "visa" },
        paymentMethod: "Credit Card (Visa **** 4242)",
        details: { rate: 450, extras: 24, protection: 45, fees: 25, tax: 39.5, manualCharges: [] },
        checkInStatus: 'completed',
        checkOutStatus: 'completed',
        checkInData: { miles: '10000', gas: 'Full', photosOutside: [], photosInside: [] },
        checkOutData: { miles: '10850', gas: '1/4', photosOutside: [], photosInside: [] },
        extraPayments: []
      },
      {
        bookingCode: '',
        date: 'Nov 20, 2023',
        status: 'Active',
        carName: 'Toyota RAV4',
        location: 'Downtown Center',
        startDate: '2023-11-20',
        startTime: '09:00 AM',
        returnDate: '2023-11-25',
        returnTime: '09:00 AM',
        days: 5,
        total: 450.00,
        image: 'https://images.unsplash.com/photo-1568844293986-8c8e46c8d1f6?w=500',
        driver: {
          name: "Ana Pereira",
          phone: "(212) 555-9988",
          email: "ana.p@email.com",
          licenseNumber: "NY-11223344",
          licenseImages: []
        },
        paymentRaw: { cardName: "ANA PEREIRA", cardNumber: "5555 4444 3333 2222", expiry: "10/25", cvc: "456", type: "mastercard" },
        paymentMethod: "Credit Card (Mastercard **** 2222)",
        details: { rate: 325, extras: 0, protection: 75, fees: 25, tax: 25, manualCharges: [] },
        checkInStatus: 'completed',
        checkOutStatus: 'pending',
        checkInData: { miles: '5000', gas: 'Full', photosOutside: [], photosInside: [] },
        checkOutData: null,
        extraPayments: []
      }
    ];

    mockBookings.forEach(b => this.createBooking(b));
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values());
  }

  async getVehicleSummaries(): Promise<VehicleSummary[]> {
    return Array.from(this.vehicles.values()).map((vehicle) => ({
      ...vehicle,
      images: [],
      imagesCount: Array.isArray(vehicle.images) ? vehicle.images.length : 0,
    }));
  }

  // Get available vehicles for specific date range (filters out booked vehicles)
  async getAvailableVehicles(startDate: string, endDate: string): Promise<Vehicle[]> {
    const allVehicles = Array.from(this.vehicles.values());
    const allBookings = Array.from(this.bookings.values());
    
    // Filter out vehicles with conflicting bookings
    return allVehicles.filter(vehicle => {
      const hasConflict = allBookings.some(booking => {
        // Pending requests do not reserve vehicles. They are revalidated when
        // approved and again immediately before payment activates the booking.
        if (booking.status !== 'Active' && booking.status !== 'Extended') return false;
        
        // Check for date overlap
        const bookingStart = new Date(booking.startDate).getTime();
        const bookingEnd = new Date(booking.returnDate).getTime();
        const queryStart = new Date(startDate).getTime();
        const queryEnd = new Date(endDate).getTime();
        
        // Overlap exists if: queryStart < bookingEnd AND queryEnd > bookingStart
        return queryStart < bookingEnd && queryEnd > bookingStart;
      });
      
      return !hasConflict;
    });
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const id = this.vehicleId++;
    const newVehicle: Vehicle = { 
      id, 
      model: vehicle.model,
      category: vehicle.category,
      price: vehicle.price,
      fuel: vehicle.fuel ?? 'Gasoline',
      seats: vehicle.seats ?? 5,
      transmission: vehicle.transmission ?? 'Automatic',
      driveType: vehicle.driveType ?? 'AWD',
      year: vehicle.year ?? null,
      vinNumber: vehicle.vinNumber ?? null,
      licensePlate: vehicle.licensePlate ?? null,
      hostName: vehicle.hostName ?? null,
      images: vehicle.images ?? [],
      consumption: vehicle.consumption ?? null,
      isPriceMatch: vehicle.isPriceMatch ?? false,
      isAWD: vehicle.isAWD ?? false,
      hasCarPlay: vehicle.hasCarPlay ?? false,
      hasBluetooth: vehicle.hasBluetooth ?? false,
      hasReverseCamera: vehicle.hasReverseCamera ?? false,
      hasHeatedSeats: vehicle.hasHeatedSeats ?? false,
      hasHeatedSteering: vehicle.hasHeatedSteering ?? false,
      hasElectricSeats: vehicle.hasElectricSeats ?? false,
      hasPaddleShifters: vehicle.hasPaddleShifters ?? false,
      hasKeylessEntry: vehicle.hasKeylessEntry ?? false,
      hasBlindSpotWarning: vehicle.hasBlindSpotWarning ?? false,
      hasDriveAssist: vehicle.hasDriveAssist ?? false,
      hasUSBCharger: vehicle.hasUSBCharger ?? false,
      hostId: vehicle.hostId ?? null,
      commission: vehicle.commission ?? 10,
      deductible: vehicle.deductible ?? 2250,
      availableLocations: vehicle.availableLocations ?? [],
      deliveryAddress: vehicle.deliveryAddress ?? '',
      isDeliveryEnabled: vehicle.isDeliveryEnabled ?? false,
      maxDeliveryDistance: vehicle.maxDeliveryDistance ?? 50,
      minDeliveryFeeMiles: vehicle.minDeliveryFeeMiles ?? 5,
      minDeliveryFee: vehicle.minDeliveryFee ?? 15,
      deliveryPricePerMile: vehicle.deliveryPricePerMile ?? 2.50,
      minDeliveryHours: vehicle.minDeliveryHours ?? 6,
      pickupInstructions: vehicle.pickupInstructions ?? '',
      locationLat: vehicle.locationLat ?? null,
      locationLon: vehicle.locationLon ?? null,
      pricing: (vehicle.pricing as Vehicle["pricing"] | null | undefined) ?? null,
      expenses: vehicle.expenses ?? null,
      transferRequests: [],
      availabilityStatus: vehicle.availabilityStatus ?? 'available',
      createdAt: new Date(),
    };
    this.vehicles.set(id, newVehicle);
    return newVehicle;
  }

  async restoreVehicle(id: number, vehicle: InsertVehicle): Promise<Vehicle> {
    const created = await this.createVehicle(vehicle);
    this.vehicles.delete(created.id);
    const restored = { ...created, id } as Vehicle;
    this.vehicles.set(id, restored);
    this.vehicleId = Math.max(this.vehicleId, id + 1);
    return restored;
  }

  async updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const existing = this.vehicles.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...vehicle } as Vehicle;
    this.vehicles.set(id, updated);
    return updated;
  }

  async deleteVehicle(id: number): Promise<boolean> {
    return this.vehicles.delete(id);
  }

  // Bookings
  async getBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }

  async getBookingFinancialSummaries(): Promise<BookingFinancialSummary[]> {
    return Array.from(this.bookings.values()).map((booking) => ({
      status: booking.status,
      carName: booking.carName,
      startDate: booking.startDate,
      total: booking.total,
      checkInStatus: booking.checkInStatus,
      checkOutStatus: booking.checkOutStatus,
    }));
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async getBookingByCode(code: string): Promise<Booking | undefined> {
    return Array.from(this.bookings.values()).find(b => b.bookingCode === code);
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const id = this.bookingId++;
    const bookingCode = booking.bookingCode || this.generateBookingCode();
    const driver = {
      name: booking.driver.name,
      phone: booking.driver.phone,
      email: booking.driver.email,
      licenseNumber: booking.driver.licenseNumber,
      licenseImages: [...booking.driver.licenseImages] as string[],
    };
    const details = {
      rate: booking.details.rate,
      extras: booking.details.extras,
      protection: booking.details.protection,
      fees: booking.details.fees,
      tax: booking.details.tax,
      discount: booking.details.discount as number | undefined,
      extendedRate: booking.details.extendedRate as number | undefined,
      manualCharges: booking.details.manualCharges as { type: string; amount: number }[] | undefined,
    };
    const newBooking: Booking = { 
      id, 
      bookingCode,
      date: booking.date,
      status: booking.status ?? 'Active',
      carName: booking.carName,
      location: booking.location,
      startDate: booking.startDate,
      startTime: booking.startTime,
      returnDate: booking.returnDate,
      returnTime: booking.returnTime,
      days: booking.days,
      total: booking.total,
      driver,
      details,
      checkInStatus: booking.checkInStatus ?? 'pending',
      checkOutStatus: booking.checkOutStatus ?? 'pending',
      unread: true,
      createdAt: new Date(),
      vehicleId: booking.vehicleId ?? null,
      image: booking.image ?? null,
      paymentRaw: (booking.paymentRaw as Booking["paymentRaw"] | null | undefined) ?? null,
      paymentMethod: booking.paymentMethod ?? null,
      licenseVerification: (booking.licenseVerification as Booking["licenseVerification"] | null | undefined) ?? null,
      checkInData: booking.checkInData ? {
        miles: booking.checkInData.miles,
        gas: booking.checkInData.gas,
        photosOutside: [...booking.checkInData.photosOutside] as string[],
        photosInside: [...booking.checkInData.photosInside] as string[],
      } : null,
      checkOutData: booking.checkOutData ? {
        miles: booking.checkOutData.miles,
        gas: booking.checkOutData.gas,
        photosOutside: [...booking.checkOutData.photosOutside] as string[],
        photosInside: [...booking.checkOutData.photosInside] as string[],
      } : null,
      hostCheckInData: (booking as any).hostCheckInData ? {
        miles: (booking as any).hostCheckInData.miles,
        gas: (booking as any).hostCheckInData.gas,
        photosOutside: [...((booking as any).hostCheckInData.photosOutside || [])] as string[],
        photosInside: [...((booking as any).hostCheckInData.photosInside || [])] as string[],
      } : null,
      hostCheckOutData: (booking as any).hostCheckOutData ? {
        miles: (booking as any).hostCheckOutData.miles,
        gas: (booking as any).hostCheckOutData.gas,
        photosOutside: [...((booking as any).hostCheckOutData.photosOutside || [])] as string[],
        photosInside: [...((booking as any).hostCheckOutData.photosInside || [])] as string[],
      } : null,
      hostCheckInStatus: (booking as any).hostCheckInStatus ?? 'pending',
      hostCheckOutStatus: (booking as any).hostCheckOutStatus ?? 'pending',
      carRentalAgreement: booking.carRentalAgreement ? {
        accepted: booking.carRentalAgreement.accepted,
        clientName: booking.carRentalAgreement.clientName,
        acceptedAt: booking.carRentalAgreement.acceptedAt,
      } : null,
      extraPayments: (booking.extraPayments || []) as { id: string; type: string; amount: number; description: string; paymentMethod: string; processedAt: string; status: 'pending' | 'completed' | 'failed'; }[],
      extensionRequests: [],
      vehicleReplaceRequests: [],
      messages: [],
      userId: (booking as any).userId ?? null,
    };
    this.bookings.set(id, newBooking);
    return newBooking;
  }

  async updateBooking(id: number, booking: Partial<InsertBooking>): Promise<Booking | undefined> {
    const existing = this.bookings.get(id);
    if (!existing) return undefined;
    
    let driver = existing.driver;
    if (booking.driver) {
      driver = {
        name: booking.driver.name,
        phone: booking.driver.phone,
        email: booking.driver.email,
        licenseNumber: booking.driver.licenseNumber,
        licenseImages: [...booking.driver.licenseImages] as string[],
      };
    }
    
    let details = existing.details;
    if (booking.details) {
      details = {
        rate: booking.details.rate,
        extras: booking.details.extras,
        protection: booking.details.protection,
        fees: booking.details.fees,
        tax: booking.details.tax,
        discount: booking.details.discount as number | undefined,
        extendedRate: booking.details.extendedRate as number | undefined,
        manualCharges: booking.details.manualCharges as { type: string; amount: number }[] | undefined,
      };
    }
    
    const updated: Booking = { 
      ...existing, 
      ...booking,
      driver,
      details,
      paymentRaw: booking.paymentRaw !== undefined
        ? (booking.paymentRaw as Booking["paymentRaw"] | null)
        : existing.paymentRaw,
      licenseVerification: booking.licenseVerification !== undefined
        ? (booking.licenseVerification as Booking["licenseVerification"] | null)
        : existing.licenseVerification,
      checkInData: booking.checkInData ? {
        miles: booking.checkInData.miles,
        gas: booking.checkInData.gas,
        photosOutside: [...booking.checkInData.photosOutside] as string[],
        photosInside: [...booking.checkInData.photosInside] as string[],
      } : existing.checkInData,
      checkOutData: booking.checkOutData ? {
        miles: booking.checkOutData.miles,
        gas: booking.checkOutData.gas,
        photosOutside: [...booking.checkOutData.photosOutside] as string[],
        photosInside: [...booking.checkOutData.photosInside] as string[],
      } : existing.checkOutData,
      hostCheckInData: (booking as any).hostCheckInData ? {
        miles: (booking as any).hostCheckInData.miles,
        gas: (booking as any).hostCheckInData.gas,
        photosOutside: [...((booking as any).hostCheckInData.photosOutside || [])] as string[],
        photosInside: [...((booking as any).hostCheckInData.photosInside || [])] as string[],
      } : (existing as any).hostCheckInData,
      hostCheckOutData: (booking as any).hostCheckOutData ? {
        miles: (booking as any).hostCheckOutData.miles,
        gas: (booking as any).hostCheckOutData.gas,
        photosOutside: [...((booking as any).hostCheckOutData.photosOutside || [])] as string[],
        photosInside: [...((booking as any).hostCheckOutData.photosInside || [])] as string[],
      } : (existing as any).hostCheckOutData,
      extensionRequests: booking.extensionRequests ? [...booking.extensionRequests] as { id: string; type: 'extension' | 'reduction'; requestedReturnDate: string; requestedReturnTime: string; reason: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string; respondedAt?: string; }[] : existing.extensionRequests,
      extraPayments: booking.extraPayments ? [...booking.extraPayments] as { id: string; type: string; amount: number; description: string; paymentMethod: string; processedAt: string; status: 'pending' | 'completed' | 'failed'; }[] : existing.extraPayments,
      vehicleReplaceRequests: (booking as any).vehicleReplaceRequests ? [...(booking as any).vehicleReplaceRequests] : existing.vehicleReplaceRequests,
      messages: booking.messages ? [...booking.messages] as { id: string; sender: 'client' | 'admin'; text: string; createdAt: string; read: boolean; }[] : existing.messages,
      unread: booking.unread !== undefined ? booking.unread : existing.unread,
    };
    this.bookings.set(id, updated);
    return updated;
  }

  async deleteBooking(id: number): Promise<boolean> {
    return this.bookings.delete(id);
  }

  // Settings
  async getSetting(key: string): Promise<Settings | undefined> {
    return this.settings.get(key);
  }

  async setSetting(key: string, value: any): Promise<Settings> {
    const existing = this.settings.get(key);
    if (existing) {
      const updated = { ...existing, value };
      this.settings.set(key, updated);
      return updated;
    }
    const id = this.settingsId++;
    const newSetting: Settings = { id, key, value };
    this.settings.set(key, newSetting);
    return newSetting;
  }

  async getAllSettings(): Promise<Settings[]> {
    return Array.from(this.settings.values());
  }

  // Hosts
  async getHosts(): Promise<Host[]> {
    return Array.from(this.hosts.values());
  }

  async getHost(id: number): Promise<Host | undefined> {
    return this.hosts.get(id);
  }

  async getHostByUsername(username: string): Promise<Host | undefined> {
    const hosts = Array.from(this.hosts.values());
    for (const host of hosts) {
      if (host.username.toLowerCase() === username.toLowerCase()) {
        return host;
      }
    }
    return undefined;
  }

  async getHostByEmail(email: string): Promise<Host | undefined> {
    const hosts = Array.from(this.hosts.values());
    for (const host of hosts) {
      if (host.email.toLowerCase() === email.toLowerCase()) {
        return host;
      }
    }
    return undefined;
  }

  async createHost(hostData: InsertHost): Promise<Host> {
    const id = this.hostId++;
    const newHost: Host = {
      id,
      firstName: hostData.firstName,
      lastName: hostData.lastName,
      email: hostData.email,
      phone: hostData.phone,
      address: hostData.address ?? null,
      city: hostData.city ?? null,
      state: hostData.state ?? null,
      zipCode: hostData.zipCode ?? null,
      licenseNumber: hostData.licenseNumber,
      licenseFrontImage: hostData.licenseFrontImage ?? null,
      licenseBackImage: hostData.licenseBackImage ?? null,
      proofOfResidenceImage: hostData.proofOfResidenceImage ?? null,
      socialSecurityNumber: hostData.socialSecurityNumber ?? null,
      username: hostData.username,
      passwordHash: hostData.passwordHash,
      pickupLocations: hostData.pickupLocations ?? [],
      agreementAccepted: hostData.agreementAccepted ?? false,
      agreementAcceptedAt: hostData.agreementAcceptedAt ?? null,
      status: hostData.status ?? 'active',
      bankAccount: (hostData as any).bankAccount ?? null,
      payoutSettings: (hostData as any).payoutSettings ?? null,
      stripeAccountId: (hostData as any).stripeAccountId ?? null,
      stripeOnboardingComplete: (hostData as any).stripeOnboardingComplete ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.hosts.set(id, newHost);
    return newHost;
  }

  async updateHost(id: number, hostData: Partial<InsertHost>): Promise<Host | undefined> {
    const existing = this.hosts.get(id);
    if (!existing) return undefined;
    const updated: Host = {
      ...existing,
      firstName: hostData.firstName ?? existing.firstName,
      lastName: hostData.lastName ?? existing.lastName,
      email: hostData.email ?? existing.email,
      phone: hostData.phone ?? existing.phone,
      address: hostData.address ?? existing.address,
      city: hostData.city ?? existing.city,
      state: hostData.state ?? existing.state,
      zipCode: hostData.zipCode ?? existing.zipCode,
      licenseNumber: hostData.licenseNumber ?? existing.licenseNumber,
      licenseFrontImage: hostData.licenseFrontImage ?? existing.licenseFrontImage,
      licenseBackImage: hostData.licenseBackImage ?? existing.licenseBackImage,
      proofOfResidenceImage: hostData.proofOfResidenceImage ?? existing.proofOfResidenceImage,
      socialSecurityNumber: hostData.socialSecurityNumber ?? existing.socialSecurityNumber,
      username: hostData.username ?? existing.username,
      passwordHash: hostData.passwordHash ?? existing.passwordHash,
      pickupLocations: hostData.pickupLocations ?? existing.pickupLocations,
      agreementAccepted: hostData.agreementAccepted ?? existing.agreementAccepted,
      agreementAcceptedAt: hostData.agreementAcceptedAt ?? existing.agreementAcceptedAt,
      status: hostData.status ?? existing.status,
      updatedAt: new Date(),
    };
    this.hosts.set(id, updated);
    return updated;
  }

  async deleteHost(id: number): Promise<boolean> {
    return this.hosts.delete(id);
  }

  // Ratings (MemStorage stub)
  private ratingsMap: Map<number, Rating> = new Map();
  private ratingId = 1;

  async getRatings(): Promise<Rating[]> {
    return Array.from(this.ratingsMap.values());
  }

  async getRating(id: number): Promise<Rating | undefined> {
    return this.ratingsMap.get(id);
  }

  async getRatingsByVehicle(vehicleId: number): Promise<Rating[]> {
    return Array.from(this.ratingsMap.values()).filter(r => r.vehicleId === vehicleId);
  }

  async getRatingByBooking(bookingId: number): Promise<Rating | undefined> {
    return Array.from(this.ratingsMap.values()).find(r => r.bookingId === bookingId);
  }

  async createRating(ratingData: InsertRating): Promise<Rating> {
    const id = this.ratingId++;
    const newRating: Rating = {
      id,
      bookingId: ratingData.bookingId,
      vehicleId: ratingData.vehicleId,
      clientName: ratingData.clientName,
      clientEmail: ratingData.clientEmail,
      hostId: ratingData.hostId ?? null,
      stars: ratingData.stars,
      comment: ratingData.comment ?? null,
      hostResponse: ratingData.hostResponse ?? null,
      hostResponseAt: null,
      hostStarsToClient: null,
      hostCommentToClient: null,
      hostRatedClientAt: null,
      createdAt: new Date(),
    };
    this.ratingsMap.set(id, newRating);
    return newRating;
  }

  async updateRating(id: number, ratingData: Partial<InsertRating>): Promise<Rating | undefined> {
    const existing = this.ratingsMap.get(id);
    if (!existing) return undefined;
    const updated: Rating = {
      ...existing,
      ...ratingData,
      hostResponseAt: ratingData.hostResponse ? new Date() : existing.hostResponseAt,
    };
    this.ratingsMap.set(id, updated);
    return updated;
  }

  async deleteRating(id: number): Promise<boolean> {
    return this.ratingsMap.delete(id);
  }

  // Support Messages (MemStorage)
  async getSupportMessages(): Promise<SupportMessage[]> {
    return Array.from(this.supportMessagesMap.values());
  }

  async getSupportMessagesByType(senderType: string): Promise<SupportMessage[]> {
    return Array.from(this.supportMessagesMap.values()).filter(m => m.senderType === senderType);
  }

  async getSupportMessage(id: number): Promise<SupportMessage | undefined> {
    return this.supportMessagesMap.get(id);
  }

  async createSupportMessage(messageData: InsertSupportMessage & { subject?: string; chatStartedAt?: Date }): Promise<SupportMessage> {
    const id = this.supportMessageId++;
    
    // Determine chatStartedAt: if provided, use it; otherwise check for active chat with same subject
    let chatStartedAt = messageData.chatStartedAt;
    if (!chatStartedAt) {
      const activeChat = Array.from(this.supportMessagesMap.values()).find(m =>
        m.senderId === messageData.senderId &&
        m.senderType === messageData.senderType &&
        m.subject === (messageData.subject || 'Duvidas') &&
        !m.isFinished
      );
      chatStartedAt = activeChat?.chatStartedAt || new Date();
    }
    
    const newMessage: SupportMessage = {
      id,
      senderType: messageData.senderType,
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      senderIdentifier: messageData.senderIdentifier,
      senderEmail: messageData.senderEmail || null,
      subject: messageData.subject || 'Duvidas',
      text: messageData.text,
      images: messageData.images ?? [],
      read: messageData.read ?? false,
      adminReply: messageData.adminReply ?? null,
      adminRepliedAt: null,
      isFinished: false,
      finishedBy: null,
      finishedAt: null,
      chatStartedAt: chatStartedAt,
      createdAt: new Date(),
    };
    this.supportMessagesMap.set(id, newMessage);
    return newMessage;
  }

  async updateSupportMessage(id: number, messageData: Partial<InsertSupportMessage>): Promise<SupportMessage | undefined> {
    const existing = this.supportMessagesMap.get(id);
    if (!existing) return undefined;
    const updated: SupportMessage = {
      ...existing,
      ...messageData,
      adminRepliedAt: messageData.adminReply ? new Date() : existing.adminRepliedAt,
    };
    this.supportMessagesMap.set(id, updated);
    return updated;
  }

  async deleteSupportMessage(id: number): Promise<boolean> {
    return this.supportMessagesMap.delete(id);
  }

  async finishSupportMessageGroup(senderIdentifier: string, senderType: string, finishedBy: string): Promise<boolean> {
    const messages = Array.from(this.supportMessagesMap.values());
    let updated = false;
    for (const msg of messages) {
      if (msg.senderIdentifier === senderIdentifier) {
        msg.isFinished = true;
        msg.finishedBy = finishedBy;
        msg.finishedAt = new Date();
        updated = true;
      }
    }
    return updated;
  }

  async finishSupportMessageGroupBySubjectAndSender(subject: string, senderId: string, finishedBy: string, chatStartedAt?: Date): Promise<boolean> {
    const messages = Array.from(this.supportMessagesMap.values());
    let updated = false;
    for (const msg of messages) {
      const matchesChatTime = !chatStartedAt || (msg.chatStartedAt && new Date(msg.chatStartedAt).getTime() === new Date(chatStartedAt).getTime());
      if (msg.subject === subject && msg.senderId === senderId && !msg.isFinished && matchesChatTime) {
        msg.isFinished = true;
        msg.finishedBy = finishedBy;
        msg.finishedAt = new Date();
        updated = true;
      }
    }
    return updated;
  }

  async getLastFinishedChat(subject: string, senderId: string): Promise<SupportMessage | null> {
    const messages = Array.from(this.supportMessagesMap.values());
    const finished = messages.filter(m => m.subject === subject && m.senderId === senderId && m.isFinished);
    if (finished.length === 0) return null;
    return finished[finished.length - 1];
  }

  async reopenChat(subject: string, senderId: string, chatStartedAt?: Date): Promise<boolean> {
    const messages = Array.from(this.supportMessagesMap.values());
    let updated = false;
    for (const msg of messages) {
      const matchesChatTime = !chatStartedAt || (msg.chatStartedAt && new Date(msg.chatStartedAt).getTime() === new Date(chatStartedAt).getTime());
      if (msg.subject === subject && msg.senderId === senderId && matchesChatTime) {
        if (msg.isFinished) {
          msg.isFinished = false;
          msg.finishedBy = null;
          msg.finishedAt = null;
          updated = true;
        }
      }
    }
    return updated;
  }

  async getUnreadSupportMessagesCount(senderType: string): Promise<number> {
    return Array.from(this.supportMessagesMap.values()).filter(m => m.senderType === senderType && !m.read).length;
  }

  private payoutsMap: Map<number, Payout> = new Map();
  private payoutCounter = 1;

  async getPayoutsByHost(hostId: number): Promise<Payout[]> {
    return Array.from(this.payoutsMap.values()).filter(p => p.hostId === hostId).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createPayout(payout: InsertPayout): Promise<Payout> {
    const id = this.payoutCounter++;
    const record: Payout = {
      ...payout,
      id,
      type: payout.type ?? 'instant',
      status: payout.status ?? 'completed',
      note: payout.note ?? null,
      stripeTransferId: payout.stripeTransferId ?? null,
      createdAt: new Date(),
    };
    this.payoutsMap.set(id, record);
    return record;
  }
}

// Database Storage Implementation
  // Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private db: any;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Try DATABASE_URL first, then construct from individual PG* variables
      let connectionString = process.env.DATABASE_URL;
      
      if (!connectionString) {
        console.log("[Storage] DATABASE_URL not found, trying to construct from PG* variables...");
        const pgHost = process.env.PGHOST;
        const pgUser = process.env.PGUSER;
        const pgPassword = process.env.PGPASSWORD;
        const pgDatabase = process.env.PGDATABASE;
        const pgPort = process.env.PGPORT || "5432";
        
        
        if (pgHost && pgUser && pgPassword && pgDatabase) {
          connectionString = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=require`;
          console.log("[Storage] Successfully constructed connection string from PG* variables");
        }
      }
      
      if (!connectionString) {
        console.error("[Storage] CRITICAL: No database connection available. Using MemStorage (data will not persist!)");
        console.error("[Storage] Environment check - NODE_ENV:", process.env.NODE_ENV);
        console.error("[Storage] Environment check - DATABASE_URL exists:", !!process.env.DATABASE_URL);
        console.error("[Storage] Environment check - PGHOST exists:", !!process.env.PGHOST);
        return;
      }
      
      try {
        console.log("[Storage] Attempting to connect to database...");
        const pool = new pg.Pool({ connectionString });
        this.db = drizzle(pool);
        
        await pool.query("SELECT 1");
        
        this.initialized = true;
        console.log("[Storage] Database successfully initialized, connected, and verified");
      } catch (error: any) {
        console.error("[Storage] Failed to initialize database or verify connection:", error);
        if (error?.message) {
          console.error("[Storage] Error detail:", error.message);
        }
        this.initialized = false;
      }
    })();

    return this.initPromise;
  }

  constructor() {
    // Initialized by initializeStorage() in index.ts or explicitly
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase())).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user by email:", error);
      return undefined;
    }
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    if (!this.initialized) throw new Error("Database not initialized");
    if (!user.id) user.id = crypto.randomUUID();
    const result = await this.db.insert(users).values(user).onConflictDoUpdate({
      target: users.id,
      set: user,
    }).returning();
    return result[0];
  }

  async createUser(user: UpsertUser): Promise<User> {
    if (!this.initialized) throw new Error("Database not initialized");
    try {
      const userId = crypto.randomUUID();
      const result = await this.db.insert(users).values({ ...user, id: userId }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    if (!this.initialized) return undefined;
    try {
      const { createdAt, updatedAt, id: _, ...safeUpdates } = updates as any;
      const result = await this.db.update(users).set(safeUpdates).where(eq(users.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating user:", error);
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(users);
    } catch (error) {
      console.error("Error getting all users:", error);
      return [];
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const result = await this.db.delete(users).where(eq(users.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async getUserTrips(userEmail: string): Promise<Booking[]> {
    if (!this.initialized) {
      console.log("[Storage] Database not initialized for user trips, attempting to initialize...");
      await this.init();
    }
    try {
      const emailToSearch = userEmail.trim().toLowerCase();
      console.log(`[Storage] Fetching trips for user email: "${emailToSearch}"`);
      
      const allBookings = await this.db.select().from(bookings);
      const allVehicles = await this.db.select().from(vehicles);
      const allHosts = await this.db.select().from(hosts);
      
      console.log(`[Storage] DEBUG: DB Stats - Bookings: ${allBookings.length}, Vehicles: ${allVehicles.length}, Hosts: ${allHosts.length}`);

      // 1. Bookings where the user is the driver
      const driverBookings = allBookings.filter((b: Booking) => {
        const driverEmail = (b.driver as any)?.email ? String((b.driver as any).email).trim().toLowerCase() : "";
        const matches = driverEmail === emailToSearch;
        if (matches) console.log(`[Storage] Found match as driver: ${b.bookingCode} (ID: ${b.id})`);
        return matches;
      });
      
      console.log(`[Storage] Found ${driverBookings.length} bookings as driver`);

      // 2. Bookings where the user is the host of the car
      const host = allHosts.find((h: Host) => (h.email || "").trim().toLowerCase() === emailToSearch);
      let hostBookings: Booking[] = [];
      
      if (host) {
        console.log(`[Storage] User identified as host ID ${host.id}`);
        // Compare as strings to handle mixed types (hostId can be number or string)
        const hostIdStr = String(host.id);
        const hostVehicleIds = allVehicles
          .filter((v: Vehicle) => String(v.hostId) === hostIdStr)
          .map((v: Vehicle) => v.id);
        
        console.log(`[Storage] Host owns vehicle IDs: ${hostVehicleIds.join(', ') || 'none'}`);
        
        hostBookings = allBookings.filter((b: Booking) => 
          b.vehicleId && hostVehicleIds.includes(b.vehicleId)
        );
        console.log(`[Storage] Found ${hostBookings.length} bookings for host vehicles`);
      }

      // 3. Fallback: Check if the booking details has the hostEmail
      const detailHostBookings = allBookings.filter((b: Booking) => {
        const hostEmail = ((b.details as any)?.hostEmail || "").trim().toLowerCase();
        const driverEmailInDetails = ((b.details as any)?.driverEmail || "").trim().toLowerCase();
        return hostEmail === emailToSearch || driverEmailInDetails === emailToSearch;
      });
      
      if (detailHostBookings.length > 0) {
        console.log(`[Storage] Found ${detailHostBookings.length} bookings matching emails in details`);
      }

      // Combine and remove duplicates using a Map
      const combinedMap = new Map<number, Booking>();
      driverBookings.forEach((b: Booking) => combinedMap.set(b.id, b));
      hostBookings.forEach((b: Booking) => combinedMap.set(b.id, b));
      detailHostBookings.forEach((b: Booking) => combinedMap.set(b.id, b));

      const result = Array.from(combinedMap.values());
      console.log(`[Storage] Returning ${result.length} unique bookings for ${emailToSearch}`);

      return result.sort((a, b) => Number(b.id) - Number(a.id));
    } catch (error) {
      console.error("Error getting user trips:", error);
      return [];
    }
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(vehicles);
    } catch (error) {
      console.error("Error getting vehicles:", error);
      return [];
    }
  }

  async getVehicleSummaries(): Promise<VehicleSummary[]> {
    if (!this.initialized) return [];
    try {
      // Avoid transferring large base64 photos for the fleet list. The
      // cardinality expression keeps image availability without selecting the
      // image array itself.
      const { images: _images, ...vehicleColumns } = getTableColumns(vehicles);
      const rows = await this.db.select({
        ...vehicleColumns,
        imagesCount: sql<number>`coalesce(cardinality(${vehicles.images}), 0)`,
      }).from(vehicles);

      return rows.map((vehicle: any) => ({
        ...vehicle,
        images: [],
        imagesCount: Number(vehicle.imagesCount || 0),
      })) as VehicleSummary[];
    } catch (error) {
      console.error("Error getting vehicle summaries:", error);
      return [];
    }
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting vehicle:", error);
      return undefined;
    }
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    if (!this.initialized) throw new Error("Database not initialized");
    try {
      const result = await this.db.insert(vehicles).values(vehicle).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating vehicle:", error);
      throw error;
    }
  }

  async restoreVehicle(id: number, vehicle: InsertVehicle): Promise<Vehicle> {
    if (!this.initialized) throw new Error("Database not initialized");
    try {
      const result = await this.db.insert(vehicles).values({ ...vehicle, id } as any).returning();
      await this.db.execute(sql`
        SELECT setval(
          pg_get_serial_sequence('vehicles', 'id'),
          GREATEST((SELECT COALESCE(MAX(id), 1) FROM vehicles), 1),
          true
        )
      `);
      return result[0];
    } catch (error) {
      console.error("Error restoring vehicle:", error);
      throw error;
    }
  }

  async updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.update(vehicles).set(vehicle).where(eq(vehicles.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating vehicle:", error);
      return undefined;
    }
  }

  async deleteVehicle(id: number): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const result = await this.db.delete(vehicles).where(eq(vehicles.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      return false;
    }
  }

  // Bookings
  async getBookings(): Promise<Booking[]> {
    if (!this.initialized) {
      console.log("[Storage] Database not initialized, attempting to initialize...");
      await this.init();
    }
    
    // Check if still not initialized after attempt
    if (!this.initialized || !this.db) {
      console.error("[Storage] CRITICAL: Database still not initialized after init attempt!");
      return [];
    }
    
    try {
      // Simple query without orderBy to avoid any issues
      const results = await this.db.select().from(bookings);
      // (Removed noisy per-request log)
      
      // Sort by ID descending in JavaScript
      const sorted = results.sort((a: Booking, b: Booking) => Number(b.id) - Number(a.id));
      return sorted;
    } catch (error: any) {
      console.error("[Storage] Error getting bookings:", error);
      console.error("[Storage] Error details:", error?.message || "No message");
      console.error("[Storage] Error stack:", error?.stack || "No stack");
      return [];
    }
  }

  async getBookingFinancialSummaries(): Promise<BookingFinancialSummary[]> {
    if (!this.initialized) {
      await this.init();
    }
    if (!this.initialized || !this.db) return [];

    try {
      return await this.db.select({
        status: bookings.status,
        carName: bookings.carName,
        startDate: bookings.startDate,
        total: bookings.total,
        checkInStatus: bookings.checkInStatus,
        checkOutStatus: bookings.checkOutStatus,
      }).from(bookings);
    } catch (error) {
      console.error("Error getting booking financial summaries:", error);
      return [];
    }
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting booking:", error);
      return undefined;
    }
  }

  async getBookingByCode(code: string): Promise<Booking | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(bookings).where(sql`LOWER(${bookings.bookingCode}) = LOWER(${code})`).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting booking by code:", error);
      return undefined;
    }
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    if (!this.initialized) throw new Error("Database not initialized");
    try {
      // Avoid serializing the full booking (which contains base64 images)
      console.log("[Storage] Creating booking:", booking.bookingCode);
      const result = await this.db.insert(bookings).values(booking).returning();
      console.log("[Storage] Booking created with ID:", result[0].id);
      return result[0];
    } catch (error) {
      console.error("Error creating booking:", error);
      throw error;
    }
  }

  async updateBooking(id: number, booking: Partial<InsertBooking>): Promise<Booking | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.update(bookings).set(booking).where(eq(bookings.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating booking:", error);
      return undefined;
    }
  }

  async deleteBooking(id: number): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const result = await this.db.delete(bookings).where(eq(bookings.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting booking:", error);
      return false;
    }
  }

  // Settings
  async getSetting(key: string): Promise<Settings | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(settings).where(eq(settings.key, key)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting setting:", error);
      return undefined;
    }
  }

  async setSetting(key: string, value: any): Promise<Settings> {
    if (!this.initialized) throw new Error("Database not initialized");
    // Convert null/undefined to 0 for numeric settings
    if (value === null || value === undefined) {
      value = 0;
    }
    try {
      const existing = await this.getSetting(key);
      if (existing) {
        const result = await this.db.update(settings).set({ value }).where(eq(settings.key, key)).returning();
        return result[0];
      }
      const result = await this.db.insert(settings).values({ key, value }).returning();
      return result[0];
    } catch (error) {
      console.error("Error setting setting:", error);
      throw error;
    }
  }

  async getAllSettings(): Promise<Settings[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(settings);
    } catch (error) {
      console.error("Error getting all settings:", error);
      return [];
    }
  }

  // Hosts
  async getHosts(): Promise<Host[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(hosts);
    } catch (error) {
      console.error("Error getting hosts:", error);
      return [];
    }
  }

  async getHost(id: number): Promise<Host | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(hosts).where(eq(hosts.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting host:", error);
      return undefined;
    }
  }

  async getHostByUsername(username: string): Promise<Host | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(hosts).where(eq(hosts.username, username)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting host by username:", error);
      return undefined;
    }
  }

  async getHostByEmail(email: string): Promise<Host | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(hosts).where(eq(hosts.email, email)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting host by email:", error);
      return undefined;
    }
  }

  async createHost(host: InsertHost): Promise<Host> {
    if (!this.initialized) throw new Error("Database not initialized");
    try {
      const result = await this.db.insert(hosts).values(host).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating host:", error);
      throw error;
    }
  }

  async updateHost(id: number, host: Partial<InsertHost>): Promise<Host | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.update(hosts).set(host).where(eq(hosts.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating host:", error);
      return undefined;
    }
  }

  async deleteHost(id: number): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const result = await this.db.delete(hosts).where(eq(hosts.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting host:", error);
      return false;
    }
  }

  // Ratings
  async getRatings(): Promise<Rating[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(ratings);
    } catch (error) {
      console.error("Error getting ratings:", error);
      return [];
    }
  }

  async getRating(id: number): Promise<Rating | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(ratings).where(eq(ratings.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting rating:", error);
      return undefined;
    }
  }

  async getRatingsByVehicle(vehicleId: number): Promise<Rating[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(ratings).where(eq(ratings.vehicleId, vehicleId));
    } catch (error) {
      console.error("Error getting ratings by vehicle:", error);
      return [];
    }
  }

  async getRatingByBooking(bookingId: number): Promise<Rating | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(ratings).where(eq(ratings.bookingId, bookingId)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting rating by booking:", error);
      return undefined;
    }
  }

  async createRating(rating: InsertRating): Promise<Rating> {
    if (!this.initialized) throw new Error("Database not initialized");
    try {
      const result = await this.db.insert(ratings).values(rating).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating rating:", error);
      throw error;
    }
  }

  async updateRating(id: number, ratingData: Partial<InsertRating>): Promise<Rating | undefined> {
    if (!this.initialized) return undefined;
    try {
      const updateData: any = { ...ratingData };
      if (ratingData.hostResponse) {
        updateData.hostResponseAt = new Date();
      }
      const result = await this.db.update(ratings).set(updateData).where(eq(ratings.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating rating:", error);
      return undefined;
    }
  }

  async deleteRating(id: number): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const result = await this.db.delete(ratings).where(eq(ratings.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting rating:", error);
      return false;
    }
  }

  // Support Messages
  async getSupportMessages(): Promise<SupportMessage[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(supportMessages);
    } catch (error) {
      console.error("Error getting support messages:", error);
      return [];
    }
  }

  async getSupportMessagesByType(senderType: string): Promise<SupportMessage[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(supportMessages).where(eq(supportMessages.senderType, senderType));
    } catch (error) {
      console.error("Error getting support messages by type:", error);
      return [];
    }
  }

  async getSupportMessage(id: number): Promise<SupportMessage | undefined> {
    if (!this.initialized) return undefined;
    try {
      const result = await this.db.select().from(supportMessages).where(eq(supportMessages.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting support message:", error);
      return undefined;
    }
  }

  async createSupportMessage(messageData: InsertSupportMessage & { subject?: string; chatStartedAt?: Date }): Promise<SupportMessage> {
    if (!this.initialized) throw new Error("Database not initialized");
    try {
      // Determine chatStartedAt: if provided, use it; otherwise check for active chat with same subject
      let chatStartedAt = messageData.chatStartedAt;
      if (!chatStartedAt) {
        const activeChat = await this.db.select().from(supportMessages).where(
          and(
            eq(supportMessages.senderId, messageData.senderId),
            eq(supportMessages.senderType, messageData.senderType),
            eq(supportMessages.subject, messageData.subject || 'Duvidas'),
            eq(supportMessages.isFinished, false)
          )
        ).limit(1);
        chatStartedAt = activeChat.length > 0 ? activeChat[0].chatStartedAt : new Date();
      }
      
      const result = await this.db.insert(supportMessages).values({
        ...messageData,
        subject: messageData.subject || 'Duvidas',
        chatStartedAt: chatStartedAt
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating support message:", error);
      throw error;
    }
  }

  async updateSupportMessage(id: number, messageData: Partial<InsertSupportMessage>): Promise<SupportMessage | undefined> {
    if (!this.initialized) return undefined;
    try {
      const updateData: any = { ...messageData };
      if (messageData.adminReply) {
        updateData.adminRepliedAt = new Date();
      }
      const result = await this.db.update(supportMessages).set(updateData).where(eq(supportMessages.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error("Error updating support message:", error);
      return undefined;
    }
  }

  async finishSupportMessageGroup(senderIdentifier: string, senderType: string, finishedBy: string): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const filter = senderType === 'client' 
        ? eq(supportMessages.senderIdentifier, senderIdentifier)
        : or(
            eq(supportMessages.senderIdentifier, senderIdentifier),
            eq(supportMessages.senderEmail, senderIdentifier)
          );
      
      const result = await this.db.update(supportMessages).set({ 
        isFinished: true, 
        finishedBy,
        finishedAt: new Date()
      }).where(filter).returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error finishing support message group:", error);
      return false;
    }
  }

  async finishSupportMessageGroupBySubjectAndSender(subject: string, senderId: string, finishedBy: string): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      // Update all messages with matching subject and sender that are not yet finished
      const result = await this.db.update(supportMessages).set({ 
        isFinished: true, 
        finishedBy,
        finishedAt: new Date()
      }).where(
        and(
          eq(supportMessages.subject, subject),
          eq(supportMessages.senderId, senderId),
          eq(supportMessages.isFinished, false)
        )
      ).returning();
      
      console.log(`[FinishChat] Finished ${result.length} messages for subject: ${subject}, senderId: ${senderId}`);
      return true;
    } catch (error) {
      console.error("Error finishing support message group:", error);
      return false;
    }
  }

  async getLastFinishedChat(subject: string, senderId: string): Promise<SupportMessage | null> {
    if (!this.initialized) return null;
    try {
      const result = await this.db.select().from(supportMessages).where(
        and(
          eq(supportMessages.subject, subject),
          eq(supportMessages.senderId, senderId),
          eq(supportMessages.isFinished, true)
        )
      ).orderBy(supportMessages.finishedAt).limit(1);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error("Error getting last finished chat:", error);
      return null;
    }
  }

  async reopenChat(subject: string, senderId: string, chatStartedAt?: Date): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const whereCondition = and(
        eq(supportMessages.subject, subject),
        eq(supportMessages.senderId, senderId),
        eq(supportMessages.isFinished, true)
      );
      const result = await this.db.update(supportMessages).set({
        isFinished: false,
        finishedBy: null,
        finishedAt: null
      }).where(whereCondition).returning();
      console.log(`[ReopenChat] Reopened ${result.length} messages for subject: ${subject}, senderId: ${senderId}`);
      return result.length > 0;
    } catch (error) {
      console.error("Error reopening chat:", error);
      return false;
    }
  }

  async deleteSupportMessage(id: number): Promise<boolean> {
    if (!this.initialized) return false;
    try {
      const result = await this.db.delete(supportMessages).where(eq(supportMessages.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting support message:", error);
      return false;
    }
  }


  async getUnreadSupportMessagesCount(senderType: string): Promise<number> {
    if (!this.initialized) return 0;
    try {
      const messages = await this.db.select().from(supportMessages).where(eq(supportMessages.senderType, senderType));
      return messages.filter((m: SupportMessage) => !m.read).length;
    } catch (error) {
      console.error("Error getting unread support messages count:", error);
      return 0;
    }
  }

  async getPayoutsByHost(hostId: number): Promise<Payout[]> {
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(payouts).where(eq(payouts.hostId, hostId)).orderBy(desc(payouts.createdAt));
    } catch (error) {
      console.error("Error getting payouts:", error);
      return [];
    }
  }

  async createPayout(payout: InsertPayout): Promise<Payout> {
    const result = await this.db.insert(payouts).values(payout).returning();
    return result[0];
  }

  // Email OTP for booking lookup
  generateEmailOTP(email: string): string {
    const normalizedEmail = email.toLowerCase().trim();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    (this as any).emailOTPs = (this as any).emailOTPs || new Map();
    (this as any).emailOTPs.set(normalizedEmail, { code, expiresAt, attempts: 0 });
    return code;
  }

  validateEmailOTP(email: string, code: string): boolean {
    const normalizedEmail = email.toLowerCase().trim();
    (this as any).emailOTPs = (this as any).emailOTPs || new Map();
    const otp = (this as any).emailOTPs.get(normalizedEmail);
    if (!otp || otp.expiresAt < Date.now()) {
      (this as any).emailOTPs.delete(normalizedEmail);
      return false;
    }
    if (otp.attempts >= 5) {
      (this as any).emailOTPs.delete(normalizedEmail);
      return false;
    }
    if (otp.code !== code) {
      otp.attempts++;
      return false;
    }
    (this as any).emailOTPs.delete(normalizedEmail);
    return true;
  }

  // Password reset tokens
  generatePasswordResetToken(email: string): string {
    const token = crypto.randomUUID();
    // Store in memory with expiration time
    (this as any).passwordResetTokens = (this as any).passwordResetTokens || new Map();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    (this as any).passwordResetTokens.set(token, { email, expiresAt });
    return token;
  }

  validatePasswordResetToken(token: string): { email: string } | null {
    (this as any).passwordResetTokens = (this as any).passwordResetTokens || new Map();
    const reset = (this as any).passwordResetTokens.get(token);
    if (!reset || reset.expiresAt < Date.now()) {
      (this as any).passwordResetTokens.delete(token);
      return null;
    }
    return { email: reset.email };
  }

  invalidatePasswordResetToken(token: string): void {
    (this as any).passwordResetTokens = (this as any).passwordResetTokens || new Map();
    (this as any).passwordResetTokens.delete(token);
  }
}

// Initialize storage with DatabaseStorage (tables created in PostgreSQL)
const storage = new DatabaseStorage();

// Initialize storage explicitly (call this before starting the server)
async function initializeStorage(): Promise<boolean> {
  console.log("[Storage] Starting storage initialization...");
  console.log("[Storage] Environment check on startup:");
  console.log(`  - DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`);
  console.log(`  - PGHOST: ${process.env.PGHOST ? 'set' : 'NOT SET'}`);
  console.log(`  - PGUSER: ${process.env.PGUSER ? 'set' : 'NOT SET'}`);
  console.log(`  - PGPASSWORD: ${process.env.PGPASSWORD ? 'set' : 'NOT SET'}`);
  console.log(`  - PGDATABASE: ${process.env.PGDATABASE ? 'set' : 'NOT SET'}`);
  console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  
  await storage.init();
  
  const isInitialized = (storage as any).initialized === true;
  console.log(`[Storage] Initialization complete. Database connected: ${isInitialized}`);
  
  if (!isInitialized) {
    console.error("[Storage] WARNING: Database not connected! Data will NOT persist!");
    console.error("[Storage] Please ensure DATABASE_URL secret is configured for this deployment.");
  }
  
  return isInitialized;
}

export { storage, initializeStorage };
