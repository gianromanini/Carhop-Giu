# Economy Car Rental Website - Design Guidelines

## Design Approach
**Reference-Based Approach** drawing from:
- **Airbnb**: Card-based browsing, clean search interface
- **Booking.com**: Smart filter systems, urgency/savings indicators
- **Stripe**: Streamlined checkout flow
- **Turo**: Vehicle presentation and trust elements

Core principle: Budget-conscious clarity meets aspirational travel

## Typography System
- **Primary Font**: Inter (Google Fonts) - for UI, body text, and data
- **Display Font**: Space Grotesk (Google Fonts) - for headlines and pricing callouts
- **Hierarchy**:
  - Hero headline: text-5xl/text-6xl, font-bold
  - Section headers: text-3xl/text-4xl, font-semibold
  - Card titles: text-xl, font-semibold
  - Body text: text-base
  - Small print/labels: text-sm
  - Pricing (emphasis): text-2xl/text-3xl, font-bold

## Layout & Spacing
**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, and 24
- Section padding: py-16 md:py-24
- Card padding: p-6
- Component gaps: gap-6 or gap-8
- Container: max-w-7xl mx-auto px-4

## Core Components

### Navigation
Top navigation with:
- Logo (left)
- Pickup/Return location and date inputs (center, prominent)
- Login + "Manage Booking" links (right)
- Sticky on scroll with subtle shadow

### Hero Section (80vh)
Full-width background image with centered search module overlay:
- Large search card with blurred background (backdrop-blur-xl)
- Location autocomplete, date pickers, vehicle type selector
- Prominent "Search Cars" button
- Value proposition tagline above search: "Economy Cars from $19/day"
- Price match guarantee badge

### Vehicle Cards (3-column grid on desktop, 1-column mobile)
Each card includes:
- Vehicle photo (16:9 aspect ratio)
- Car name and category badge
- MPG rating with leaf icon (fuel saver indicator)
- Price per day (large, bold) with "Pay Now" discount tag
- Key specs grid: passengers, transmission, luggage
- "View Details" button

### Filter Sidebar
Sticky sidebar (desktop) / collapsible drawer (mobile):
- Price range slider
- Fuel saver toggle (highlighted with green accent)
- Transmission type checkboxes
- Passenger capacity selector
- Sortby dropdown (price low-to-high, MPG, popularity)

### Price Match Tool Section
Dedicated card/modal:
- Competitor name input
- Price input field
- Upload screenshot option (placeholder)
- Submit button with "We'll beat it or match it" guarantee text
- Small print about terms

### Quick Checkout Flow (3-step progress indicator)
**Step 1 - Reservation Details**: Selected car summary, dates, location, extras (insurance, GPS)
**Step 2 - Driver Information**: Form with name, email, phone, driver's license
**Step 3 - Payment**: Pay now vs pay later toggle with savings calculator, credit card form, booking summary panel

### Pay Now Discount Display
Comparison table format:
- Two columns: "Pay Now" (highlighted) vs "Pay Later"
- Show price difference with savings badge (e.g., "Save $45")
- Benefits list under each option
- Visual emphasis on pay now with subtle background treatment

### Trust Elements
Footer section with:
- "24/7 Customer Support" with phone icon
- "Price Match Guarantee" with shield icon
- "No Hidden Fees" with checkmark icon
- "Free Cancellation" with calendar icon

## Images

**Hero Image**: Wide landscape of scenic highway/open road with economy car in distance, bright and aspirational but budget-friendly feel (not luxury). Dimensions: 1920x1080 minimum.

**Vehicle Photos**: Clean side-profile shots on white/light gray background showing full car, consistent lighting. Dimensions: 800x450 per card.

**Section Backgrounds**: Subtle texture or gradient overlays, never competing with content.

**Trust Section**: Small icon-style illustrations for customer support, guarantee badges (use icon library, not photos).

## Navigation & Interaction Patterns
- Filters apply immediately (no "Apply" button needed)
- Date picker shows price calendar overlay
- Fuel saver filter adds green highlight to qualifying cards
- Sticky "Reserve" button appears on scroll in vehicle detail pages
- Toast notifications for price match submissions
- Real-time savings calculator in checkout

## Accessibility
- All form inputs with visible labels
- High contrast ratios for pricing and CTAs
- Keyboard navigation for all interactive elements
- Alt text for all vehicle images following pattern: "[Year] [Make] [Model] - [Category]"

**Mobile Considerations**: 
- Search inputs stack vertically
- Cards full-width with horizontal scrolling for vehicle photos
- Filters in bottom sheet drawer
- Sticky "View [X] Cars" button at bottom when filters active

This design balances economy positioning with modern, trustworthy aesthetics that encourage immediate booking through strategic discount visibility and streamlined checkout.