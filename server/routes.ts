import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertVehicleSchema, insertBookingSchema } from "@shared/schema";

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // ========== VEHICLES ==========
  app.get("/api/vehicles", async (_req, res) => {
    const vehicles = await storage.getVehicles();
    res.json(vehicles);
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const vehicle = await storage.getVehicle(id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    res.json(vehicle);
  });

  app.post("/api/vehicles", async (req, res) => {
    const result = insertVehicleSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    const vehicle = await storage.createVehicle(result.data);
    res.status(201).json(vehicle);
  });

  app.put("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = insertVehicleSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    const vehicle = await storage.updateVehicle(id, result.data);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
    res.json(vehicle);
  });

  app.delete("/api/vehicles/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteVehicle(id);
    if (!deleted) return res.status(404).json({ error: "Vehicle not found" });
    res.status(204).send();
  });

  // ========== BOOKINGS ==========
  app.get("/api/bookings", async (_req, res) => {
    const bookings = await storage.getBookings();
    res.json(bookings);
  });

  app.get("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  });

  app.get("/api/bookings/code/:code", async (req, res) => {
    const booking = await storage.getBookingByCode(req.params.code);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  });

  app.post("/api/bookings", async (req, res) => {
    const result = insertBookingSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    const booking = await storage.createBooking(result.data);
    res.status(201).json(booking);
  });

  app.put("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const result = insertBookingSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    const booking = await storage.updateBooking(id, result.data);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  });

  app.delete("/api/bookings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteBooking(id);
    if (!deleted) return res.status(404).json({ error: "Booking not found" });
    res.status(204).send();
  });

  // ========== EXTENSION REQUESTS ==========
  app.post("/api/bookings/:id/extension-request", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { type, requestedReturnDate, requestedReturnTime, reason } = req.body;
    const newRequest = {
      id: `ext-${Date.now()}`,
      type: type as 'extension' | 'reduction',
      requestedReturnDate,
      requestedReturnTime,
      reason: reason || '',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };
    
    const extensionRequests = [...(booking.extensionRequests || []), newRequest];
    const updated = await storage.updateBooking(id, { extensionRequests });
    res.json(updated);
  });

  app.put("/api/bookings/:id/extension-request/:requestId", async (req, res) => {
    const id = parseInt(req.params.id);
    const requestId = req.params.requestId;
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { status } = req.body; // 'approved' or 'rejected'
    const extensionRequests = (booking.extensionRequests || []).map(r => {
      if (r.id === requestId) {
        return { ...r, status, respondedAt: new Date().toISOString() };
      }
      return r;
    });
    
    // If approved, update the booking dates
    const approvedRequest = extensionRequests.find(r => r.id === requestId && r.status === 'approved');
    let updateData: any = { extensionRequests };
    
    if (approvedRequest) {
      updateData.returnDate = approvedRequest.requestedReturnDate;
      updateData.returnTime = approvedRequest.requestedReturnTime;
      // Recalculate days
      const startDate = new Date(booking.startDate);
      const newReturnDate = new Date(approvedRequest.requestedReturnDate);
      const diffTime = newReturnDate.getTime() - startDate.getTime();
      const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      updateData.days = Math.max(1, newDays);
      // Recalculate total
      const rate = booking.details?.rate || 0;
      updateData.total = rate * updateData.days + (booking.details?.extras || 0) + (booking.details?.protection || 0) + (booking.details?.fees || 0) + (booking.details?.tax || 0) - (booking.details?.discount || 0);
    }
    
    const updated = await storage.updateBooking(id, updateData);
    res.json(updated);
  });

  // ========== CHAT MESSAGES ==========
  app.post("/api/bookings/:id/messages", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { sender, text } = req.body;
    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: sender as 'client' | 'admin',
      text,
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    const messages = [...(booking.messages || []), newMessage];
    const updated = await storage.updateBooking(id, { messages });
    res.json(updated);
  });

  // ========== EXTRA PAYMENTS ==========
  app.post("/api/bookings/:id/charge-extra", async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    const { type, amount, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    
    const paymentMethod = booking.paymentMethod || 'Credit Card';
    const newPayment = {
      id: `pay-${Date.now()}`,
      type: type || 'Extra Charge',
      amount: parseFloat(amount),
      description: description || '',
      paymentMethod,
      processedAt: new Date().toISOString(),
      status: 'completed' as const,
    };
    
    const extraPayments = [...(booking.extraPayments || []), newPayment];
    const newTotal = (booking.total || 0) + parseFloat(amount);
    
    const updated = await storage.updateBooking(id, { 
      extraPayments,
      total: newTotal 
    });
    
    res.json({ 
      success: true, 
      payment: newPayment,
      booking: updated 
    });
  });

  app.put("/api/bookings/:id/messages/read", async (req, res) => {
    const id = parseInt(req.params.id);
    const { reader } = req.body; // 'client' or 'admin'
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    
    // Mark all messages from the other party as read
    const messages = (booking.messages || []).map(m => {
      if (m.sender !== reader) {
        return { ...m, read: true };
      }
      return m;
    });
    
    const updated = await storage.updateBooking(id, { messages });
    res.json(updated);
  });

  // ========== SETTINGS ==========
  app.get("/api/settings", async (_req, res) => {
    const allSettings = await storage.getAllSettings();
    const settingsObj: Record<string, any> = {};
    allSettings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  });

  app.get("/api/settings/:key", async (req, res) => {
    const setting = await storage.getSetting(req.params.key);
    if (!setting) return res.status(404).json({ error: "Setting not found" });
    res.json(setting.value);
  });

  app.put("/api/settings/:key", async (req, res) => {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: "Value is required" });
    }
    const setting = await storage.setSetting(req.params.key, value);
    res.json(setting);
  });

  // ========== FINANCIAL SUMMARY ==========
  app.get("/api/financial/summary", async (_req, res) => {
    const bookings = await storage.getBookings();
    const vehicles = await storage.getVehicles();

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData: Record<string, { gross: number; expenses: number; net: number; pending: number }> = {};
    const vehicleTotals: Record<string, { gross: number; pending: number; expenses: number }> = {};
    const vehicleExpenses: Record<number, any> = {};

    monthNames.forEach(m => monthlyData[m] = { gross: 0, expenses: 0, net: 0, pending: 0 });

    vehicles.forEach(car => {
      const carExp = car.expenses || { lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 };
      // Monthly expenses exclude downPayment (one-time cost)
      const monthlyExpenses = (carExp.lease || 0) + (carExp.insurance || 0) + (carExp.carWash || 0) + (carExp.maintenance || 0) + (carExp.trackApp || 0);
      vehicleExpenses[car.id] = {
        id: car.id,
        model: car.model,
        expenses: carExp,
        totalExpenses: monthlyExpenses
      };
      vehicleTotals[car.model] = { gross: 0, pending: 0, expenses: monthlyExpenses };
    });

    const totalFleetFixedExpenses = vehicles.reduce((sum, car) => {
      const carExp = car.expenses || { lease: 0, insurance: 0, carWash: 0, maintenance: 0, trackApp: 0, downPayment: 0 };
      // Down Payment is NOT included in monthly expenses (it's a one-time cost)
      return sum + (carExp.lease || 0) + (carExp.insurance || 0) + (carExp.carWash || 0) + (carExp.maintenance || 0) + (carExp.trackApp || 0);
    }, 0);

    bookings.forEach(b => {
      const [y, m, d] = b.startDate.split('-').map(Number);
      const monthIndex = m - 1;
      const monthKey = monthIndex >= 0 && monthIndex < 12 ? monthNames[monthIndex] : null;
      const carKey = b.carName;
      
      if (!vehicleTotals[carKey]) {
        vehicleTotals[carKey] = { gross: 0, pending: 0, expenses: 0 };
      }

      if (b.status === 'Completed' && b.checkOutStatus === 'completed') {
        if (monthKey) monthlyData[monthKey].gross += b.total;
        vehicleTotals[carKey].gross += b.total;
      } else if (['Active', 'Extended'].includes(b.status) && b.checkInStatus === 'completed' && b.checkOutStatus !== 'completed') {
        if (monthKey) monthlyData[monthKey].pending += b.total;
        vehicleTotals[carKey].pending += b.total;
      } else if (['Active', 'Extended'].includes(b.status)) {
        if (monthKey) monthlyData[monthKey].pending += b.total;
        vehicleTotals[carKey].pending += b.total;
      }
    });

    monthNames.forEach(m => {
      monthlyData[m].expenses = totalFleetFixedExpenses;
      monthlyData[m].net = monthlyData[m].gross - totalFleetFixedExpenses;
    });

    res.json({ 
      monthly: monthlyData, 
      byVehicle: vehicleTotals, 
      vehicleExpenses: Object.values(vehicleExpenses),
      fixedMonthly: totalFleetFixedExpenses 
    });
  });
}
