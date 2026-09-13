---
name: Orphaned booking vehicles
description: How to keep historical bookings usable when their vehicle row is missing.
---

An active or extended booking may still reference a vehicle ID that no longer exists in the production `vehicles` table. The booking can retain the vehicle name, year, historical pricing fields, and a booking image even when `/api/vehicles/:id` would otherwise return 404.

**Why:** Deleting a vehicle row without an audit trail or cascade leaves reservations visually incomplete and breaks Host Fleet, On a Trip, extensions, and image loading.

**How to apply:** For staff-facing views and booking detail routes, recover a non-persistent snapshot from the booking first. Keep the snapshot marked unavailable/orphaned, serve images through a cacheable image route, and do not silently create or mutate production vehicle rows.