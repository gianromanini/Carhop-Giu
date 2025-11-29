# CarHop - Economy Car Rental Platform

## Overview

CarHop is a budget-focused car rental web application built with React and Express. The platform emphasizes fuel-efficient economy vehicles with transparent pricing, featuring a "pay now" discount model and a price match guarantee. The application provides a streamlined rental experience inspired by Airbnb's card-based browsing, Booking.com's filter systems, and Stripe's checkout flow.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query (React Query) for server state
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui component library

**Design System:**
- Uses "new-york" style variant of shadcn/ui
- Custom color palette based on neutral tones with green primary (#22c55e area)
- Typography: Inter for UI/body, Space Grotesk for headlines
- Responsive spacing primitives (2, 4, 6, 8, 12, 16, 24)
- Dark mode support via ThemeProvider context

**Component Architecture:**
- Modular component structure under `client/src/components/`
- Page-level components in `client/src/pages/`
- Reusable UI primitives in `client/src/components/ui/`
- Context-based theme management for light/dark modes
- Example components provided for development reference

**Key Features:**
- Vehicle browsing with advanced filtering (price range, fuel efficiency, transmission, drivetrain, passengers)
- Multi-step checkout flow with payment option comparison
- Price match guarantee submission system
- Responsive search interface with date pickers and location autocomplete
- Trust badges and social proof elements

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database ORM**: Drizzle ORM
- **Database**: PostgreSQL (via Neon serverless driver)
- **Validation**: Zod schemas with drizzle-zod integration

**API Design:**
- RESTful API structure under `/api` routes
- Vehicle listing with query-based filtering (`/api/vehicles`)
- Individual vehicle details (`/api/vehicles/:id`)
- Customer management endpoints
- Reservation creation and management
- Price match request submissions

**Data Models:**
- **Users**: Authentication credentials (username/password)
- **Vehicles**: Car inventory with specifications (MPG, passengers, transmission, drivetrain, pricing tiers)
- **Customers**: Rental customer information (contact details, license)
- **Reservations**: Booking records with confirmation numbers
- **Price Matches**: Competitor price comparison requests

**Storage Pattern:**
- Interface-based storage layer (`IStorage`) for flexibility
- In-memory implementation (`MemStorage`) for development
- Database implementation ready via Drizzle ORM
- Filtering logic at storage layer for vehicle queries

**Request Handling:**
- JSON body parsing with raw body preservation for webhooks
- Custom logging middleware with timestamps
- CORS and security considerations built-in
- Error handling with appropriate HTTP status codes

### Build System

**Development:**
- Vite dev server with HMR via middleware mode
- TypeScript compilation with path aliases (`@/`, `@shared/`, `@assets/`)
- Replit-specific plugins for development experience

**Production:**
- esbuild for server bundling with selective dependency bundling
- Vite for client-side production build
- Static file serving from Express
- Single-page application fallback routing

**Configuration:**
- Shared TypeScript configuration across client/server
- PostCSS with Tailwind and Autoprefixer
- ES modules throughout the stack

### External Dependencies

**Database:**
- PostgreSQL (expected via `DATABASE_URL` environment variable)
- Neon serverless PostgreSQL driver for edge compatibility
- Drizzle ORM for type-safe database queries
- Migration system via `drizzle-kit`

**UI Libraries:**
- Radix UI for accessible component primitives
- Lucide React for icons
- date-fns for date manipulation
- embla-carousel for image carousels
- cmdk for command palette patterns

**Development Tools:**
- Replit-specific Vite plugins (runtime error overlay, cartographer, dev banner)
- TypeScript for type safety across stack
- Zod for runtime validation

**Asset Management:**
- Vehicle images stored in `attached_assets/generated_images/`
- Vite alias for asset imports (`@assets/`)
- Hero background and vehicle-specific imagery

**Sessions & Auth:**
- connect-pg-simple for PostgreSQL-backed sessions
- express-session middleware (configuration expected)
- Passport.js ready for authentication strategies