import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertReservationSchema, insertPriceMatchSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/vehicles", async (req, res) => {
    try {
      const { priceMin, priceMax, fuelSaverOnly, transmission, drivetrain, passengers, sortBy } = req.query;
      
      const filters = {
        priceMin: priceMin ? parseFloat(priceMin as string) : undefined,
        priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
        fuelSaverOnly: fuelSaverOnly === "true",
        transmission: transmission ? (transmission as string).split(",") : undefined,
        drivetrain: drivetrain ? (drivetrain as string).split(",") : undefined,
        passengers: passengers ? parseInt(passengers as string) : undefined,
      };
      
      let vehicles = await storage.getVehicles(filters);
      
      if (sortBy) {
        switch (sortBy) {
          case "price-low":
            vehicles.sort((a, b) => a.payNowPrice - b.payNowPrice);
            break;
          case "price-high":
            vehicles.sort((a, b) => b.payNowPrice - a.payNowPrice);
            break;
          case "mpg":
            vehicles.sort((a, b) => b.mpg - a.mpg);
            break;
        }
      }
      
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vehicle" });
    }
  });

  const createReservationSchema = z.object({
    vehicle: z.object({
      id: z.string(),
      pricePerDay: z.number(),
      payNowPrice: z.number(),
    }),
    customer: insertCustomerSchema,
    location: z.string(),
    pickupDate: z.string().transform(s => new Date(s)),
    returnDate: z.string().transform(s => new Date(s)),
    paymentOption: z.enum(["now", "later"]),
    extras: z.object({
      insurance: z.boolean().default(false),
      cleaningFee: z.boolean().default(false),
      childSeat: z.boolean().default(false),
    }),
  });

  app.post("/api/reservations", async (req, res) => {
    try {
      const data = createReservationSchema.parse(req.body);
      
      let customer = await storage.getCustomerByEmail(data.customer.email);
      if (!customer) {
        customer = await storage.createCustomer(data.customer);
      }
      
      const days = Math.ceil((data.returnDate.getTime() - data.pickupDate.getTime()) / (1000 * 60 * 60 * 24));
      const basePrice = data.paymentOption === "now" ? data.vehicle.payNowPrice : data.vehicle.pricePerDay;
      const extrasPrice = (data.extras.insurance ? 15 : 0) + (data.extras.cleaningFee ? 10 : 0) + (data.extras.childSeat ? 5 : 0);
      const totalPrice = (basePrice + extrasPrice) * days;
      
      const confirmationNumber = `CH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const reservation = await storage.createReservation({
        confirmationNumber,
        vehicleId: data.vehicle.id,
        customerId: customer.id,
        location: data.location,
        pickupDate: data.pickupDate,
        returnDate: data.returnDate,
        paymentOption: data.paymentOption,
        insurance: data.extras.insurance,
        cleaningFee: data.extras.cleaningFee,
        childSeat: data.extras.childSeat,
        totalPrice,
        status: "confirmed",
      });
      
      res.status(201).json({
        ...reservation,
        customer,
        vehicle: await storage.getVehicle(data.vehicle.id),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Reservation error:", error);
      res.status(500).json({ message: "Failed to create reservation" });
    }
  });

  app.get("/api/reservations/lookup/:confirmationNumber", async (req, res) => {
    try {
      const reservation = await storage.getReservationByConfirmation(req.params.confirmationNumber);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      
      const [vehicle, customer] = await Promise.all([
        storage.getVehicle(reservation.vehicleId),
        storage.getCustomer(reservation.customerId),
      ]);
      
      res.json({
        ...reservation,
        vehicle,
        customer,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to lookup reservation" });
    }
  });

  app.patch("/api/reservations/:id/cancel", async (req, res) => {
    try {
      const reservation = await storage.updateReservationStatus(req.params.id, "cancelled");
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel reservation" });
    }
  });

  const priceMatchRequestSchema = z.object({
    customerEmail: z.string().email(),
    competitorName: z.string().min(1),
    competitorPrice: z.number().positive(),
    vehicleType: z.string().min(1),
    pickupDate: z.string().transform(s => new Date(s)),
    returnDate: z.string().transform(s => new Date(s)),
    proofUrl: z.string().url().optional(),
  });

  app.post("/api/price-match", async (req, res) => {
    try {
      const data = priceMatchRequestSchema.parse(req.body);
      
      const priceMatch = await storage.createPriceMatch({
        customerEmail: data.customerEmail,
        competitorName: data.competitorName,
        competitorPrice: data.competitorPrice,
        vehicleType: data.vehicleType,
        pickupDate: data.pickupDate,
        returnDate: data.returnDate,
        proofUrl: data.proofUrl,
      });
      
      res.status(201).json(priceMatch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to submit price match request" });
    }
  });

  app.get("/api/price-match/:id", async (req, res) => {
    try {
      const priceMatch = await storage.getPriceMatch(req.params.id);
      if (!priceMatch) {
        return res.status(404).json({ message: "Price match request not found" });
      }
      res.json(priceMatch);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch price match request" });
    }
  });

  return httpServer;
}
