import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertVehicleSchema, insertBookingSchema, insertHostSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./googleAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const signupSchema = z.object({
  firstName: z.string().min(2, "First name required"),
  lastName: z.string().min(2, "Last name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Valid phone number required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // ========== AUTHENTICATION (Google OAuth) ==========
  await setupAuth(app);

  // Auth routes - get current authenticated user
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Traditional signup route
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const result = signupSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
      }

      const { firstName, lastName, email, phone, password } = result.data;

      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const user = await storage.createUser({
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
      });

      // Send confirmation email
      const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
      const loginUrl = `${baseUrl}/`;
      
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to CarHop - Account Confirmation",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">Welcome to CarHop!</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
                <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${firstName} ${lastName}</strong>,</p>
                
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                  Your CarHop account has been successfully created! Here are your account details:
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                  <p style="margin: 0 0 10px 0; color: #6b7280;">
                    <strong style="color: #1f2937;">Name:</strong> ${firstName} ${lastName}
                  </p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;">
                    <strong style="color: #1f2937;">Email:</strong> ${email}
                  </p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;">
                    <strong style="color: #1f2937;">Phone:</strong> ${phone}
                  </p>
                  <p style="margin: 0; color: #6b7280;">
                    <strong style="color: #1f2937;">Password:</strong> ${password}
                  </p>
                </div>
                
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                  You're all set! Click the button below to log in to your account and start booking your perfect ride.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                    Sign In to CarHop
                  </a>
                </div>
                
                <p style="font-size: 12px; color: #9ca3af; margin: 20px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                  If you did not create this account, please ignore this email. If you have any questions, please contact us at (475) 449-8622.
                </p>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        // Don't fail the signup if email fails, just log it
      }

      // Set session
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.status(201).json({ message: "Account created successfully", user });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // Traditional login route
  app.post('/api/auth/login', async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
      }

      const { email, password } = result.data;

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.json({ message: "Logged in successfully", user });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Update user profile
  app.patch('/api/auth/profile', isAuthenticated, async (req: any, res) => {
    try {
      const profileSchema = z.object({
        firstName: z.string().min(2, "First name required").optional(),
        lastName: z.string().min(2, "Last name required").optional(),
        phone: z.string().min(10, "Valid phone number required").optional(),
      });

      const result = profileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
      }

      const userId = req.user.id;
      const updates = result.data;

      // Update user in storage
      const user = await storage.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Profile updated successfully", user });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Profile update failed" });
    }
  });

  // ========== VEHICLES ==========
  app.get("/api/vehicles", async (req, res) => {
    const vehicles = await storage.getVehicles();
    const hosts = await storage.getHosts();
    const hostsMap = new Map(hosts.map(h => [h.id.toString(), h]));
    
    const vehiclesWithHost = vehicles.map(v => ({
      ...v,
      hostInfo: v.hostId ? {
        id: hostsMap.get(v.hostId)?.id,
        firstName: hostsMap.get(v.hostId)?.firstName,
        lastName: hostsMap.get(v.hostId)?.lastName,
        city: hostsMap.get(v.hostId)?.city,
        state: hostsMap.get(v.hostId)?.state,
      } : null,
    }));
    
    res.json(vehiclesWithHost);
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
      // Recalculate days and adjust pricing
      const startDate = new Date(booking.startDate);
      const newReturnDate = new Date(approvedRequest.requestedReturnDate);
      const diffTime = newReturnDate.getTime() - startDate.getTime();
      const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      updateData.days = Math.max(1, newDays);
      
      // Calculate the difference in days from original booking
      const oldDays = booking.days || 1;
      const daysDifference = newDays - oldDays;
      
      // Calculate the daily rate based on original booking
      const baseRate = booking.details?.rate || 0;
      const dailyRate = baseRate / oldDays;
      
      // Adjust total based on days difference
      const rateDifference = dailyRate * daysDifference;
      const taxOnDifference = rateDifference * ((booking.details?.tax || 0) / (baseRate || 1));
      
      updateData.total = booking.total + rateDifference + taxOnDifference;
      updateData.details = {
        ...booking.details,
        extendedRate: (booking.details?.extendedRate || 0) + rateDifference
      };
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

  // ========== HOST ROUTES ==========
  // Get all hosts (Admin Matriz only)
  app.get("/api/hosts", async (_req, res) => {
    try {
      const hosts = await storage.getHosts();
      // Don't send password hashes to frontend
      const safeHosts = hosts.map(h => ({ ...h, passwordHash: undefined }));
      res.json(safeHosts);
    } catch (error) {
      console.error("Error fetching hosts:", error);
      res.status(500).json({ message: "Failed to fetch hosts" });
    }
  });

  // Get single host
  app.get("/api/hosts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const host = await storage.getHost(id);
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json({ ...host, passwordHash: undefined });
    } catch (error) {
      console.error("Error fetching host:", error);
      res.status(500).json({ message: "Failed to fetch host" });
    }
  });

  // Host registration
  app.post("/api/hosts/register", async (req, res) => {
    try {
      const { firstName, lastName, email, phone, address, city, state, zipCode,
              licenseNumber, licenseFrontImage, licenseBackImage, proofOfResidenceImage, username, password,
              agreementAccepted, agreementAcceptedAt } = req.body;

      // Validate agreement acceptance
      if (!agreementAccepted) {
        return res.status(400).json({ message: "You must accept the Host Partner Agreement" });
      }

      // Check if username already exists
      const existingUsername = await storage.getHostByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Check if email already exists
      const existingEmail = await storage.getHostByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const host = await storage.createHost({
        firstName, lastName, email, phone, address, city, state, zipCode,
        licenseNumber, licenseFrontImage, licenseBackImage, proofOfResidenceImage, username, passwordHash, 
        agreementAccepted: true,
        agreementAcceptedAt: agreementAcceptedAt ? new Date(agreementAcceptedAt) : new Date(),
        status: 'pending'
      });

      // Send confirmation email with agreement copy
      const baseUrl = process.env.BASE_URL || `http://${req.get('host')}`;
      const loginUrl = `${baseUrl}/`;
      const agreementDate = agreementAcceptedAt ? new Date(agreementAcceptedAt).toLocaleString() : new Date().toLocaleString();
      
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to CarHop Host Partner Program - Registration Confirmed",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">Welcome to CarHop Host Partner Program!</h1>
              </div>
              
              <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
                <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${firstName} ${lastName}</strong>,</p>
                
                <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                  Thank you for registering as a CarHop Host! Your account has been created and is pending verification. Our team will review your documents and credentials within 2-3 business days. You'll receive a confirmation email once your account is approved.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                  <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">Your Account Details:</h3>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Name:</strong> ${firstName} ${lastName}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Email:</strong> ${email}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Phone:</strong> ${phone}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Username:</strong> ${username}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Password:</strong> ${password}</p>
                  <p style="margin: 0 0 10px 0; color: #6b7280;"><strong style="color: #1f2937;">Address:</strong> ${address || 'N/A'}, ${city || ''} ${state || ''} ${zipCode || ''}</p>
                  <p style="margin: 0; color: #6b7280;"><strong style="color: #1f2937;">License #:</strong> ${licenseNumber}</p>
                </div>

                <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Status: Pending Verification</strong></p>
                <p style="margin: 5px 0 0 0; color: #b45309; font-size: 12px;">Your account is under review. We'll verify your documents and notify you within 2-3 business days.</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="display: inline-block; background: #d1d5db; color: #6b7280; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; cursor: not-allowed;">
                    Login to Host Dashboard (Available After Approval)
                  </a>
                </div>
              </div>

              <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 20px 0; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">Host Partner Agreement - Copy for Your Records</h2>
                <p style="font-size: 12px; color: #6b7280; margin-bottom: 15px;"><strong>Agreement Accepted:</strong> ${agreementDate}</p>
                
                <div style="font-size: 12px; color: #4b5563; line-height: 1.6;">
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">1. PARTIES AND OVERVIEW</h3>
                  <p>This Host Partner Agreement is entered into between CarHop LLC and you. By accepting this Agreement, you agree to list your vehicle(s) on the CarHop platform.</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">2. COMMISSION STRUCTURE</h3>
                  <p><strong>15% Commission Plan:</strong> $750 deductible per incident<br/>
                  <strong>25% Commission Plan:</strong> $500 deductible per incident</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">3. VEHICLE REQUIREMENTS</h3>
                  <p>Model Year 2010+, Max 120,000 Miles, clean title, registered/insured in Connecticut and we can request an Inspection in our Partners mechanics Places to approve.</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">4. INSURANCE COVERAGE</h3>
                  <p>Liability up to $1,000,000, Comprehensive & Collision at ACV (subject to deductible).</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">5. PAYMENT TERMS</h3>
                  <p>Weekly payments via ACH or PayPal, $50 minimum threshold, 3-5 business days processing.</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">6. HOST RESPONSIBILITIES</h3>
                  <p>Maintain availability calendar, respond within 2 hours, deliver clean vehicle with 1/4 tank fuel.</p>
                  
                  <h3 style="color: #1f2937; font-size: 14px; margin: 15px 0 10px 0;">7. GOVERNING LAW</h3>
                  <p>This Agreement is governed by the laws of the State of Connecticut.</p>
                </div>
                
                <p style="font-size: 11px; color: #9ca3af; margin: 20px 0 0 0; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                  This is an abbreviated copy of the agreement. The full agreement can be viewed anytime in your Host Dashboard.
                </p>
              </div>

              <div style="padding: 20px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                  Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
                  CarHop LLC - Connecticut, USA
                </p>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Host email sending error:", emailError);
      }

      res.status(201).json({ 
        message: "Host registered successfully", 
        host: { ...host, passwordHash: undefined }
      });
    } catch (error) {
      console.error("Error registering host:", error);
      res.status(500).json({ message: "Failed to register host" });
    }
  });

  // Host login
  app.post("/api/hosts/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      const host = await storage.getHostByUsername(username);
      if (!host) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, host.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (host.status !== 'active') {
        return res.status(403).json({ message: "Account is not active" });
      }

      res.json({ 
        message: "Login successful", 
        host: { ...host, passwordHash: undefined }
      });
    } catch (error) {
      console.error("Error logging in host:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Update host (Admin Matriz edit capability)
  app.patch("/api/hosts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { password, ...safeUpdates } = req.body;

      // Get the current host to check for status changes
      const hosts = await storage.getHosts();
      const previousHost = hosts.find(h => h.id === id);
      
      // Build update object with only safe fields
      const updates: any = {};
      const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode', 'status'];
      
      for (const field of allowedFields) {
        if (field in safeUpdates) {
          updates[field] = safeUpdates[field];
        }
      }

      // If password is being updated, hash it
      if (password) {
        const salt = await bcrypt.genSalt(10);
        updates.passwordHash = await bcrypt.hash(password, salt);
      }

      const host = await storage.updateHost(id, updates);
      if (!host) {
        return res.status(404).json({ message: "Host not found" });
      }

      // Send email if status changed
      console.log(`DEBUG: previousHost?.status='${previousHost?.status}' (type: ${typeof previousHost?.status}), host?.status='${host?.status}' (type: ${typeof host?.status})`);
      const statusChanged = previousHost && previousHost.status !== host.status;
      console.log(`DEBUG: statusChanged=${statusChanged}`);
      
      if (statusChanged) {
        try {
          const baseUrl = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000';
          const loginUrl = `${baseUrl}/`;
          let subject = '';
          let emailHtml = '';
          console.log(`DEBUG: ENTERING STATUS CHANGE EMAIL BLOCK: ${previousHost.status} -> ${host.status}`);
          
          if ((host.status === 'active' && previousHost.status === 'pending') || (host.status === 'active' && previousHost.status !== 'active')) {
            // Approval email - Any status to Active
            subject = 'Congratulations! Your CarHop Host Account is Approved';
            console.log(`DEBUG: Sending approval email (${previousHost.status} -> Active)`);
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">Account Approved!</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${host.firstName} ${host.lastName}</strong>,</p>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    Great news! Your CarHop Host Partner account has been <strong>approved and is now active</strong>! You're ready to start listing your vehicles and earning money.
                  </p>
                  
                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                    <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">Next Steps:</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                      <li>Login to your account with your username and password</li>
                      <li>Add your vehicles to the platform</li>
                      <li>Set your vehicle availability dates</li>
                      <li>Start earning money with your fleet!</li>
                    </ul>
                  </div>

                  <div style="background: #ecfdf5; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #047857; font-size: 14px;"><strong>Status: Active</strong></p>
                    <p style="margin: 5px 0 0 0; color: #059669; font-size: 12px;">Your account is ready to use. You can login now!</p>
                  </div>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${loginUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer;">
                      Login to Your Host Dashboard
                    </a>
                  </div>
                </div>

                <div style="padding: 20px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
                    CarHop LLC - Connecticut, USA
                  </p>
                </div>
              </div>
            `;
          } else if (host.status === 'pending') {
            // Pending/Under Review email
            subject = 'Your CarHop Host Account is Under Review';
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">Account Under Review</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${host.firstName} ${host.lastName}</strong>,</p>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    Thank you for registering with CarHop! Your application has been moved to <strong>pending review status</strong>. Our team is carefully evaluating your information.
                  </p>
                  
                  <div style="background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Status: Pending Review</strong></p>
                    <p style="margin: 5px 0 0 0; color: #b45309; font-size: 12px;">Your account is being reviewed by our administrative team</p>
                  </div>

                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                    <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">What's Next:</h3>
                    <p style="margin: 0; color: #4b5563; font-size: 12px;">
                      You'll receive an email notification once your account has been approved or if we need additional information. This typically takes 24-48 hours.
                    </p>
                  </div>

                  <p style="font-size: 12px; color: #4b5563; line-height: 1.6; margin: 20px 0;">
                    If you have any questions in the meantime, please don't hesitate to contact us.
                  </p>
                </div>

                <div style="padding: 20px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    Questions? Contact us at (475) 449-8622 or reply to this email.<br/>
                    CarHop LLC - Connecticut, USA
                  </p>
                </div>
              </div>
            `;
          } else if (host.status === 'suspended') {
            // Suspension email
            subject = 'Notice: Your CarHop Host Account Has Been Suspended';
            emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">Account Suspended</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb;">
                  <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">Hi <strong>${host.firstName} ${host.lastName}</strong>,</p>
                  
                  <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                    We regret to inform you that your CarHop Host Partner account has been <strong>suspended</strong> due to violation of our Terms of Service or illegal activity.
                  </p>
                  
                  <div style="background: #fee2e2; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason for Suspension:</strong></p>
                    <p style="margin: 5px 0 0 0; color: #b91c1c; font-size: 12px;">Terms of Service Violation or Illegal Activity</p>
                  </div>

                  <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                    <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px;">What This Means:</h3>
                    <p style="margin: 0; color: #4b5563; font-size: 12px;">
                      Your account will no longer accept bookings. All vehicles currently listed on the platform have been removed.
                    </p>
                  </div>

                  <p style="font-size: 12px; color: #4b5563; line-height: 1.6; margin: 20px 0;">
                    If you believe this is an error or would like to appeal this decision, please contact us immediately.
                  </p>
                </div>

                <div style="padding: 20px 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    Contact us at (475) 449-8622 or reply to this email for more information.<br/>
                    CarHop LLC - Connecticut, USA
                  </p>
                </div>
              </div>
            `;
          }

          console.log(`DEBUG: subject="${subject}", emailHtml exists=${!!emailHtml}`);
          if (subject && emailHtml) {
            console.log(`DEBUG: Sending email to ${host.email}`);
            await transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
              to: host.email,
              subject: subject,
              html: emailHtml,
            });
            console.log(`DEBUG: Email sent successfully to ${host.email}`);
          } else {
            console.log(`DEBUG: No email sent - subject or emailHtml empty`);
          }
        } catch (emailError) {
          console.error("Host status change email error:", emailError);
        }
      }

      res.json({ message: 'Host updated successfully', host: { ...host, passwordHash: undefined } });
    } catch (error) {
      console.error("Error updating host:", error);
      res.status(500).json({ message: "Failed to update host" });
    }
  });

  // Delete host
  app.delete("/api/hosts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteHost(id);
      if (!success) {
        return res.status(404).json({ message: "Host not found" });
      }
      res.json({ message: "Host deleted successfully" });
    } catch (error) {
      console.error("Error deleting host:", error);
      res.status(500).json({ message: "Failed to delete host" });
    }
  });

  // Get vehicles by host
  app.get("/api/hosts/:id/vehicles", async (req, res) => {
    try {
      const hostId = req.params.id;
      const vehicles = await storage.getVehicles();
      const hostVehicles = vehicles.filter(v => v.hostId === hostId);
      res.json(hostVehicles);
    } catch (error) {
      console.error("Error fetching host vehicles:", error);
      res.status(500).json({ message: "Failed to fetch vehicles" });
    }
  });

  // Get bookings by host (vehicles owned by host)
  app.get("/api/hosts/:id/bookings", async (req, res) => {
    try {
      const hostId = req.params.id;
      const vehicles = await storage.getVehicles();
      const hostVehicleIds = vehicles.filter(v => v.hostId === hostId).map(v => v.id);
      const bookings = await storage.getBookings();
      const hostBookings = bookings.filter(b => b.vehicleId && hostVehicleIds.includes(b.vehicleId));
      res.json(hostBookings);
    } catch (error) {
      console.error("Error fetching host bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Get all users (for admin clients tab)
  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user
  app.put("/api/admin/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { password, ...otherUpdates } = req.body;
      const updates = { ...otherUpdates };
      
      // Hash password if provided
      if (password) {
        const salt = await bcrypt.genSalt(10);
        (updates as any).passwordHash = await bcrypt.hash(password, salt);
      }
      
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Get user to find their email
      const users = await storage.getAllUsers();
      const userToDelete = users.find(u => u.id === id);
      
      if (!userToDelete) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete all bookings for this user
      const allBookings = await storage.getBookings();
      const userBookings = allBookings.filter(b => b.driver.email === userToDelete.email);
      for (const booking of userBookings) {
        await storage.deleteBooking(booking.id);
      }
      
      // Delete user
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
}
