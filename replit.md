# CarHop - Economy Car Rental Platform

## Overview

CarHop is a comprehensive car rental web application built with React (TanStack Query) and Express. The platform features vehicle fleet management, a complete booking system with check-in/check-out workflows, payment processing, driver verification, financial reporting, and an admin dashboard.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework**: React 18 with TypeScript
- **State Management**: TanStack Query (React Query) for server state
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Custom components with dark mode support

**Main Application:**
- Single-page application in `client/src/pages/CarHopApp.tsx`
- Multi-view navigation (home, checkout, payment, admin, bookings)
- Dark/light mode toggle
- Responsive design for mobile and desktop

**Key Features:**
- Vehicle browsing with fuel-saver filter
- Multi-step checkout flow with driver verification
- License photo upload system
- Check-in/check-out workflow with mileage and fuel tracking
- Rental extension system with automatic pricing
- Admin dashboard with Fleet, Bookings, Earnings, and Settings tabs

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Storage**: In-memory storage with mock data (ready for PostgreSQL)
- **Validation**: Zod schemas with drizzle-zod integration

**API Endpoints:**
- `GET /api/vehicles` - List all vehicles
- `GET /api/vehicles/:id` - Get vehicle by ID
- `POST /api/vehicles` - Create vehicle
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle
- `GET /api/bookings` - List all bookings
- `GET /api/bookings/:id` - Get booking by ID
- `GET /api/bookings/code/:code` - Get booking by code
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking
- `GET /api/settings` - Get all settings
- `GET /api/settings/:key` - Get specific setting
- `PUT /api/settings/:key` - Update setting
- `GET /api/financial/summary` - Get monthly financial summary

**Data Models (defined in `shared/schema.ts`):**

**Vehicles:**
- model, category, price, fuel, seats, transmission
- Feature flags: isAWD, hasCarPlay, hasBluetooth, hasReverseCamera, etc.
- expenses (JSONB): lease, insurance, carWash, maintenance, trackApp, downPayment

**Bookings:**
- bookingCode, status (Active/Extended/Completed)
- Rental dates: startDate, startTime, returnDate, returnTime
- driver (JSONB): name, phone, email, licenseNumber, licenseImages
- paymentRaw (JSONB): cardName, cardNumber, expiry, cvc, type
- details (JSONB): rate, extras, protection, fees, tax, discount, manualCharges
- checkInStatus, checkOutStatus
- checkInData/checkOutData (JSONB): miles, gas, photosOutside, photosInside

**Settings:**
- taxes, cleaningFee, includedMiles, extraMileRate
- prices (insurance500, insurance1000, childSeat)
- locations (array)

### Storage Pattern

**Interface-based design (`server/storage.ts`):**
- `IStorage` interface for flexibility
- `MemStorage` implementation with pre-populated mock data
- Ready for database migration to PostgreSQL via Drizzle ORM

### Build System

**Development:**
- `npm run dev` - Starts Express server with Vite middleware
- TypeScript compilation with path aliases (`@/`, `@shared/`, `@assets/`)
- Hot module replacement for rapid development

**Production:**
- esbuild for server bundling
- Vite for client-side production build
- Static file serving from Express

### Configuration Files

- `shared/schema.ts` - Database schema definitions with Zod validation
- `server/storage.ts` - Storage layer with in-memory implementation
- `server/routes.ts` - Express API routes
- `client/src/pages/CarHopApp.tsx` - Main application component

### Recent Changes (December 2025)

1. Migrated from Firebase to Express/TanStack Query architecture
2. Created comprehensive database schema for vehicles, bookings, and settings
3. Implemented in-memory storage with mock booking and vehicle data
4. Built RESTful API routes for all CRUD operations
5. Adapted CarHopApp.tsx to use TanStack Query for data fetching
6. Implemented complete booking lifecycle: checkout → payment → check-in → check-out
7. Added admin dashboard with fleet management, bookings overview, and financial reporting
8. Migrated to PostgreSQL database with data persistence
9. Restored all 7 vehicles: Hyundai Elantra, Hyundai Kona, Subaru Impreza, Nissan Kicks, Kia Seltos, Ford Escape, Honda Accord
10. **Mobile Responsiveness Improvements (Dec 14):**
    - Reduced "Book Now" button and price sizing for small screens (iPhone SE)
    - Fleet price: `text-base sm:text-xl` (from `text-lg sm:text-2xl`)
    - Fleet button: Added `text-xs sm:text-sm py-2 sm:py-3` for compact mobile
    - Detail page: Price `text-2xl sm:text-4xl` (from `text-4xl`)
    - Detail page: Button layout changed to flex-col on mobile, flex-row on desktop
11. **Hero Section Text Updates:**
    - Changed "Up to $39/Day" → "Starting from $39/Day"
    - Reduced "Price Match Guarantee" badge spacing: `mb-1 sm:mb-2` (from `mb-3 sm:mb-4`)

## Important Price Configuration Requirement
**CRITICAL FOR FUTURE IMPLEMENTATION:**
- Price configuration will be **PER-VEHICLE** (not global)
- Each vehicle will have its own individual pricing settings
- Button label must be: **"Update Configuration"** (not "Save Settings")
- Settings apply individually to each car in the fleet
