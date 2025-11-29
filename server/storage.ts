import { 
  type User, type InsertUser,
  type Vehicle, type InsertVehicle,
  type Customer, type InsertCustomer,
  type Reservation, type InsertReservation,
  type PriceMatch, type InsertPriceMatch
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface VehicleFilters {
  priceMin?: number;
  priceMax?: number;
  fuelSaverOnly?: boolean;
  transmission?: string[];
  drivetrain?: string[];
  passengers?: number;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getVehicles(filters?: VehicleFilters): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;

  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;

  getReservations(): Promise<Reservation[]>;
  getReservation(id: string): Promise<Reservation | undefined>;
  getReservationByConfirmation(confirmationNumber: string): Promise<Reservation | undefined>;
  getReservationsByCustomer(customerId: string): Promise<Reservation[]>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservationStatus(id: string, status: string): Promise<Reservation | undefined>;

  getPriceMatches(): Promise<PriceMatch[]>;
  getPriceMatch(id: string): Promise<PriceMatch | undefined>;
  createPriceMatch(priceMatch: InsertPriceMatch): Promise<PriceMatch>;
  updatePriceMatchStatus(id: string, status: string): Promise<PriceMatch | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private vehicles: Map<string, Vehicle>;
  private customers: Map<string, Customer>;
  private reservations: Map<string, Reservation>;
  private priceMatches: Map<string, PriceMatch>;

  constructor() {
    this.users = new Map();
    this.vehicles = new Map();
    this.customers = new Map();
    this.reservations = new Map();
    this.priceMatches = new Map();
    
    this.seedVehicles();
  }

  private seedVehicles() {
    const seedData: InsertVehicle[] = [
      {
        name: "Toyota Corolla",
        category: "Economy",
        image: "/vehicles/corolla.png",
        pricePerDay: 35,
        payNowPrice: 29,
        mpg: 32,
        passengers: 5,
        transmission: "Automatic",
        drivetrain: "FWD",
        luggage: 2,
        fuelEfficient: true,
        available: true,
      },
      {
        name: "Honda Civic",
        category: "Economy",
        image: "/vehicles/civic.png",
        pricePerDay: 38,
        payNowPrice: 32,
        mpg: 33,
        passengers: 5,
        transmission: "Automatic",
        drivetrain: "FWD",
        luggage: 2,
        fuelEfficient: true,
        available: true,
      },
      {
        name: "Nissan Versa",
        category: "Compact",
        image: "/vehicles/versa.png",
        pricePerDay: 28,
        payNowPrice: 22,
        mpg: 35,
        passengers: 5,
        transmission: "Automatic",
        drivetrain: "FWD",
        luggage: 2,
        fuelEfficient: true,
        available: true,
      },
      {
        name: "Hyundai Elantra",
        category: "Economy",
        image: "/vehicles/elantra.png",
        pricePerDay: 32,
        payNowPrice: 26,
        mpg: 31,
        passengers: 5,
        transmission: "Automatic",
        drivetrain: "FWD",
        luggage: 2,
        fuelEfficient: true,
        available: true,
      },
      {
        name: "Kia Forte",
        category: "Economy",
        image: "/vehicles/forte.png",
        pricePerDay: 30,
        payNowPrice: 24,
        mpg: 28,
        passengers: 5,
        transmission: "Automatic",
        drivetrain: "AWD",
        luggage: 2,
        fuelEfficient: false,
        available: true,
      },
      {
        name: "Mazda 3",
        category: "Compact",
        image: "/vehicles/mazda3.png",
        pricePerDay: 42,
        payNowPrice: 35,
        mpg: 30,
        passengers: 5,
        transmission: "Manual",
        drivetrain: "RWD",
        luggage: 2,
        fuelEfficient: true,
        available: true,
      },
    ];

    seedData.forEach((vehicle) => {
      const id = randomUUID();
      this.vehicles.set(id, { 
        ...vehicle, 
        id,
        fuelEfficient: vehicle.fuelEfficient ?? false,
        available: vehicle.available ?? true,
      });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getVehicles(filters?: VehicleFilters): Promise<Vehicle[]> {
    let result = Array.from(this.vehicles.values()).filter(v => v.available);

    if (filters) {
      if (filters.priceMin !== undefined) {
        result = result.filter(v => v.payNowPrice >= filters.priceMin!);
      }
      if (filters.priceMax !== undefined) {
        result = result.filter(v => v.payNowPrice <= filters.priceMax!);
      }
      if (filters.fuelSaverOnly) {
        result = result.filter(v => v.fuelEfficient);
      }
      if (filters.transmission && filters.transmission.length > 0) {
        result = result.filter(v => filters.transmission!.includes(v.transmission));
      }
      if (filters.drivetrain && filters.drivetrain.length > 0) {
        result = result.filter(v => filters.drivetrain!.includes(v.drivetrain));
      }
      if (filters.passengers !== undefined) {
        result = result.filter(v => v.passengers >= filters.passengers!);
      }
    }

    return result;
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const id = randomUUID();
    const vehicle: Vehicle = { 
      ...insertVehicle, 
      id,
      fuelEfficient: insertVehicle.fuelEfficient ?? false,
      available: insertVehicle.available ?? true,
    };
    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return undefined;
    
    const updated = { ...vehicle, ...updates };
    this.vehicles.set(id, updated);
    return updated;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(
      (customer) => customer.email === email,
    );
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const customer: Customer = { ...insertCustomer, id };
    this.customers.set(id, customer);
    return customer;
  }

  async getReservations(): Promise<Reservation[]> {
    return Array.from(this.reservations.values());
  }

  async getReservation(id: string): Promise<Reservation | undefined> {
    return this.reservations.get(id);
  }

  async getReservationByConfirmation(confirmationNumber: string): Promise<Reservation | undefined> {
    return Array.from(this.reservations.values()).find(
      (reservation) => reservation.confirmationNumber === confirmationNumber,
    );
  }

  async getReservationsByCustomer(customerId: string): Promise<Reservation[]> {
    return Array.from(this.reservations.values()).filter(
      (reservation) => reservation.customerId === customerId,
    );
  }

  async createReservation(insertReservation: InsertReservation): Promise<Reservation> {
    const id = randomUUID();
    const reservation: Reservation = { 
      ...insertReservation, 
      id,
      status: insertReservation.status ?? "confirmed",
      insurance: insertReservation.insurance ?? false,
      cleaningFee: insertReservation.cleaningFee ?? false,
      childSeat: insertReservation.childSeat ?? false,
      createdAt: new Date(),
    };
    this.reservations.set(id, reservation);
    return reservation;
  }

  async updateReservationStatus(id: string, status: string): Promise<Reservation | undefined> {
    const reservation = this.reservations.get(id);
    if (!reservation) return undefined;
    
    const updated = { ...reservation, status };
    this.reservations.set(id, updated);
    return updated;
  }

  async getPriceMatches(): Promise<PriceMatch[]> {
    return Array.from(this.priceMatches.values());
  }

  async getPriceMatch(id: string): Promise<PriceMatch | undefined> {
    return this.priceMatches.get(id);
  }

  async createPriceMatch(insertPriceMatch: InsertPriceMatch): Promise<PriceMatch> {
    const id = randomUUID();
    const priceMatch: PriceMatch = { 
      ...insertPriceMatch, 
      id,
      status: "pending",
      proofUrl: insertPriceMatch.proofUrl ?? null,
      createdAt: new Date(),
    };
    this.priceMatches.set(id, priceMatch);
    return priceMatch;
  }

  async updatePriceMatchStatus(id: string, status: string): Promise<PriceMatch | undefined> {
    const priceMatch = this.priceMatches.get(id);
    if (!priceMatch) return undefined;
    
    const updated = { ...priceMatch, status };
    this.priceMatches.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
