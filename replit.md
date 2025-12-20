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
- Location-based vehicle filtering (select location to see available cars)
- Multi-step checkout flow with driver verification
- License photo upload system
- Check-in/check-out workflow with mileage and fuel tracking
- Rental extension system with automatic pricing
- Admin dashboard with Fleet, Bookings, Earnings, and Settings tabs
- **Google Places Autocomplete** for Pickup Locations (Admin & Host Fleet)
- **Client Mobile Menu**: My Bookings button in header + Chat option in menu
- **Photo Lightbox**: Full-screen viewer with zoom and navigation for check-in/check-out photos

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Storage**: PostgreSQL database with Drizzle ORM
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
- availableLocations: string[] (locations where vehicle is available)
- Feature flags: isAWD, hasCarPlay, hasBluetooth, hasReverseCamera, etc.
- expenses (JSONB): lease, insurance, carWash, maintenance, trackApp, downPayment
- pricing (JSONB): per-vehicle pricing configuration

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
- locations (array of available pickup/return locations)

### Storage Pattern

**Interface-based design (`server/storage.ts`):**
- `IStorage` interface for flexibility
- Database implementation with PostgreSQL via Drizzle ORM
- Full data persistence

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
- `server/storage.ts` - Storage layer with database implementation
- `server/routes.ts` - Express API routes
- `client/src/pages/CarHopApp.tsx` - Main application component

### Recent Changes (December 2025)

1. Migrated from Firebase to Express/TanStack Query architecture
2. Created comprehensive database schema for vehicles, bookings, and settings
3. Implemented database storage with PostgreSQL
4. Built RESTful API routes for all CRUD operations
5. Adapted CarHopApp.tsx to use TanStack Query for data fetching
6. Implemented complete booking lifecycle: checkout → payment → check-in → check-out
7. Added admin dashboard with fleet management, bookings overview, and financial reporting
8. **Location-Based Vehicle Filtering (Dec 14):**
   - Added `availableLocations` field to vehicles schema
   - Admin can select which locations each vehicle is available at
   - Home page filters fleet based on selected location
   - Vehicles without location restrictions appear for all locations
9. **Tax Calculation Fix (Dec 18):**
   - Created `calculateCorrectTotal()` helper function
   - Properly separates Initial Payment tax and Additional Charges tax
   - Total: (rate + protection + extras + fees) + tax + (extended + charges - discount) + tax
10. **Google Places Autocomplete for Pickup Locations (Dec 18):**
    - Integrated GooglePlacesAutocomplete component in Admin Fleet
    - Integrated GooglePlacesAutocomplete component in Host Fleet
    - Both use same Google Maps API as client
    - Saves exact address coordinates for pickup locations
11. **Rating System Improvements (Dec 18):**
    - Fixed exclamation mark visibility on completed bookings
    - Exclamation disappears immediately after host rates guest
    - Shows "✓ Rated" indicator once rating is complete
12. **Security Fix (Dec 18):**
    - Generated demo password hashes at runtime instead of hardcoding
    - Installed missing `tsx` package for Node.js runtime
13. **Mobile Edit Profile (Dec 18):**
    - Added City and State fields to profile editing modal
    - Added tooltips on hover showing field descriptions
14. **Client Rental Receipt Photos (Dec 18):**
    - Fixed check-in and check-out photos not showing on receipts
    - Now displays both `photosOutside` and `photosInside`
    - Photos displayed in responsive grid
15. **Mobile Client Menu Redesign (Dec 18):**
    - Added "My Bookings" button next to hamburger menu (left side) for logged-in clients
    - Renamed "Manage Booking" to "Chat" in mobile menu
    - Photo lightbox features:
      - Click photos to open full-screen viewer
      - Zoom in/out toggle functionality
      - Navigate between photos with arrow buttons
      - Close button to exit lightbox
      - Photo counter showing current/total
16. **Delivery Approval System (Dec 20):**
    - Host/Admin can approve or decline delivery requests
    - Added `minDeliveryHours` field to vehicles for configurable advance notice (default 6 hours)
    - Customer receives automatic notifications: approval message or decline + pick-up location link
    - Delivery status indicators in client's "My Bookings": Pending Approval (yellow), Approved (green), Declined (red with pickup location link)
    - Pickup location displays as clickable Google Maps link when delivery is declined
    - API endpoint: `PUT /api/bookings/:id/delivery-approval`

## Important Price Configuration Requirement
**CRITICAL FOR FUTURE IMPLEMENTATION:**
- Price configuration is **PER-VEHICLE**
- Each vehicle has its own individual pricing settings via `pricing` JSONB field
- Button label: **"Update Configuration"** (not "Save Settings")
- Settings apply individually to each car in the fleet
