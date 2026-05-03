# CarHop - Economy Car Rental Platform

## Overview

CarHop is a comprehensive car rental web application designed to manage vehicle fleets, facilitate a complete booking system with check-in/check-out workflows, process payments, handle driver verification, generate financial reports, and provide an administrative dashboard. Its core purpose is to streamline car rental operations for both customers and administrators.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a React 18 single-page application built with TypeScript, utilizing TanStack Query for server state management and Tailwind CSS for styling with custom UI components and dark mode support. It features responsive design, multi-view navigation, vehicle browsing with location-based filtering, a multi-step checkout process with driver verification and license photo uploads, a rental extension system, and a comprehensive admin dashboard. Key integrations include Google Places Autocomplete for location inputs and a photo lightbox for image viewing.

### Backend Architecture

The backend is built with Node.js and Express.js using TypeScript. It interacts with a PostgreSQL database via Drizzle ORM, with Zod schemas for validation. The API provides RESTful endpoints for managing vehicles, bookings, and system settings. Data models define detailed structures for vehicles (including pricing and expenses), bookings (with driver, payment, and check-in/out data), and configurable settings like taxes and pricing options.

### Storage Pattern

An interface-based storage design (`IStorage`) ensures flexibility, with the current implementation using PostgreSQL and Drizzle ORM for full data persistence.

### Build System

Development uses `npm run dev` for an Express server with Vite middleware, supporting TypeScript and hot module replacement. Production builds are optimized with esbuild for the server and Vite for the client-side, serving static files from Express.

### Key Features and Implementations

- **Location-Based Vehicle Filtering**: Vehicles can be assigned to specific locations, and the frontend filters the fleet based on the user's selected location, or uses real-time geolocation with OpenStreetMap/Nominatim API and Leaflet maps for distance-based sorting.
- **Dynamic Pricing**: Price configuration is per-vehicle, managed via a `pricing` JSONB field, allowing granular control over individual car rental rates.
- **Delivery Approval System**: Allows hosts/admins to approve or decline delivery requests with configurable advance notice, triggering automatic notifications to clients.
- **Email Notification System**: Uses Nodemailer with HTML templates for various booking lifecycle events (creation, delivery, extension, cancellation, check-in/out).
- **Secure Password Reset**: Implements a two-step, token-based password reset system with email verification and bcryptjs for secure password hashing.
- **Chat Support System**: Integrates a comprehensive chat system for clients and hosts to communicate with support, including database storage for messages, an admin dashboard for managing conversations, and a client-side chat modal with image attachment capabilities.
- **Production Image Optimization**: To prevent oversized responses, list endpoints return lightweight data with image placeholders, while individual booking endpoints provide full image data on demand. The frontend caches full booking data for efficient display.
- **Host Payouts (Stripe Connect Express)**: Hosts link their bank via Stripe Connect Express onboarding (transfers capability). Payouts are admin-triggered manually: from the admin host detail view, an admin enters an amount and sends a Stripe transfer from the platform balance to the host's connected account (`POST /api/hosts/:hostId/stripe-transfer`, idempotency-key protected). Each transfer is recorded in the `payouts` table with `type='stripe'` and `stripeTransferId` for audit. There is no automatic destination-charge split; Stripe fees are reconciled separately.

## External Dependencies

- **React 18**: Frontend framework
- **TypeScript**: Language for both frontend and backend
- **TanStack Query (React Query)**: Frontend server state management
- **Tailwind CSS**: Utility-first CSS framework
- **Node.js**: Backend runtime
- **Express.js**: Backend web framework
- **PostgreSQL**: Primary database
- **Drizzle ORM**: Object-Relational Mapper for PostgreSQL
- **Zod**: Schema validation library
- **Google Places Autocomplete API**: For location input suggestions in admin and host interfaces.
- **Nominatim API (OpenStreetMap)**: For location search and autocomplete functionality.
- **Leaflet**: JavaScript library for interactive maps.
- **Nodemailer**: For sending emails.
- **bcryptjs**: For password hashing.