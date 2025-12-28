import { 
  vehicles, bookings, settings, hosts, users, ratings, supportMessages,
  type Vehicle, type InsertVehicle,
  type Booking, type InsertBooking,
  type Settings, type InsertSettings,
  type User, type UpsertUser,
  type Host, type InsertHost,
  type Rating, type InsertRating,
  type SupportMessage, type InsertSupportMessage
} from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, ilike, or, and, inArray } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD_HASH = bcrypt.hashSync("demo123", 10);

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
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<boolean>;

  // Bookings
  getBookings(): Promise<Booking[]>;
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
}

export class MemStorage implements IStorage {
  private vehicles: Map<number, Vehicle> = new Map();
  private bookings: Map<number, Booking> = new Map();
  private settings: Map<string, Settings> = new Map();
  private users: Map<string, User> = new Map();
  private hosts: Map<number, Host> = new Map();
  private supportMessagesMap: Map<number, SupportMessage> = new Map();
  private passwordResetTokens: Map<string, { email: string; expiresAt: number }> = new Map();
  private vehicleId = 1;
  private bookingId = 1;
  private settingsId = 1;
  private hostId = 1;
  private supportMessageId = 1;
  private bookingCodeCounter = 1;

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

  // Get available vehicles for specific date range (filters out booked vehicles)
  async getAvailableVehicles(startDate: string, endDate: string): Promise<Vehicle[]> {
    const allVehicles = Array.from(this.vehicles.values());
    const allBookings = Array.from(this.bookings.values());
    
    // Filter out vehicles with conflicting bookings
    return allVehicles.filter(vehicle => {
      const hasConflict = allBookings.some(booking => {
        // Skip cancelled/completed bookings
        if (booking.status === 'Completed' || booking.status === 'Cancelled') return false;
        
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
      images: vehicle.images ?? [],
      createdAt: new Date(),
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
      expenses: vehicle.expenses ?? null,
      hostId: vehicle.hostId ?? null,
      commission: vehicle.commission ?? 10,
      deductible: vehicle.deductible ?? 1000,
      availableLocations: vehicle.availableLocations ?? [],
      pricing: vehicle.pricing ?? null,
    };
    this.vehicles.set(id, newVehicle);
    return newVehicle;
  }

  async updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const existing = this.vehicles.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...vehicle };
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
      createdAt: new Date(),
      vehicleId: booking.vehicleId ?? null,
      image: booking.image ?? null,
      paymentRaw: booking.paymentRaw ?? null,
      paymentMethod: booking.paymentMethod ?? null,
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
      carRentalAgreement: booking.carRentalAgreement ? {
        accepted: booking.carRentalAgreement.accepted,
        clientName: booking.carRentalAgreement.clientName,
        acceptedAt: booking.carRentalAgreement.acceptedAt,
      } : null,
      extraPayments: (booking.extraPayments || []) as { id: string; type: string; amount: number; description: string; paymentMethod: string; processedAt: string; status: 'pending' | 'completed' | 'failed'; }[],
      extensionRequests: [],
      messages: [],
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
      extensionRequests: booking.extensionRequests ? [...booking.extensionRequests] as { id: string; type: 'extension' | 'reduction'; requestedReturnDate: string; requestedReturnTime: string; reason: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string; respondedAt?: string; }[] : existing.extensionRequests,
      extraPayments: booking.extraPayments ? [...booking.extraPayments] as { id: string; type: string; amount: number; description: string; paymentMethod: string; processedAt: string; status: 'pending' | 'completed' | 'failed'; }[] : existing.extraPayments,
      messages: booking.messages ? [...booking.messages] as { id: string; sender: 'client' | 'admin'; text: string; createdAt: string; read: boolean; }[] : existing.messages,
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
      agreementAccepted: hostData.agreementAccepted ?? false,
      agreementAcceptedAt: hostData.agreementAcceptedAt ?? null,
      status: hostData.status ?? 'active',
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

  async getUnreadSupportMessagesCount(senderType: string): Promise<number> {
    return Array.from(this.supportMessagesMap.values()).filter(m => m.senderType === senderType && !m.read).length;
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private db: any;
  private initialized: boolean = false;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn("DATABASE_URL not found, falling back to MemStorage");
      this.initialized = false;
      return;
    }
    try {
      const sql = neon(connectionString);
      this.db = drizzle(sql);
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
      this.initialized = false;
    }
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
      const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
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
    if (!this.initialized) return [];
    try {
      const allBookings = await this.db.select().from(bookings);
      return allBookings.filter((b: Booking) => b.driver?.email?.toLowerCase() === userEmail.toLowerCase());
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
    if (!this.initialized) return [];
    try {
      return await this.db.select().from(bookings);
    } catch (error) {
      console.error("Error getting bookings:", error);
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
      const result = await this.db.select().from(bookings).where(eq(bookings.bookingCode, code)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting booking by code:", error);
      return undefined;
    }
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    if (!this.initialized) throw new Error("Database not initialized");
    try {
      const result = await this.db.insert(bookings).values(booking).returning();
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
const storage: IStorage = new DatabaseStorage();

export { storage };
