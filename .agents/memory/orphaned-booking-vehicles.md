---
name: Orphaned booking vehicles
description: How to keep historical bookings usable when their vehicle row is missing.
---

An active or extended booking may still reference a vehicle ID that no longer exists in the production `vehicles` table. The booking can retain the vehicle name, year, historical pricing fields, and a booking image even when `/api/vehicles/:id` would otherwise return 404.

**Why:** Deleting a vehicle row without an audit trail or cascade leaves reservations visually incomplete and breaks Host Fleet, On a Trip, extensions, and image loading.

**How to apply:** For read-only staff views and booking detail routes, recover a non-persistent snapshot from the booking first. Keep it unavailable/orphaned and serve images through a cacheable image route. If an authorized user explicitly saves edits to that orphan, restore the vehicle row with its historical ID and merged booking data; never create it as a side effect of a read.

**Why:** A missing row must not be recreated just because a list or detail page was opened, but an explicit Fleet edit needs a durable record to save changes without breaking the booking's vehicle ID.