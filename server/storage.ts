import { 
  vehicles, bookings, settings, hosts,
  type Vehicle, type InsertVehicle,
  type Booking, type InsertBooking,
  type Settings, type InsertSettings,
  type User, type UpsertUser,
  type Host, type InsertHost
} from "@shared/schema";

export interface IStorage {
  // Users (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
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
}

export class MemStorage implements IStorage {
  private vehicles: Map<number, Vehicle> = new Map();
  private bookings: Map<number, Booking> = new Map();
  private settings: Map<string, Settings> = new Map();
  private users: Map<string, User> = new Map();
  private hosts: Map<number, Host> = new Map();
  private vehicleId = 1;
  private bookingId = 1;
  private settingsId = 1;
  private hostId = 1;
  private bookingCodeCounter = 1;

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
      passwordHash: userData.passwordHash ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      isAdmin: userData.isAdmin ?? false,
      isHost: userData.isHost ?? false,
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
      passwordHash: userData.passwordHash ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      isAdmin: userData.isAdmin ?? false,
      isHost: userData.isHost ?? false,
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
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
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
}

export const storage = new MemStorage();
