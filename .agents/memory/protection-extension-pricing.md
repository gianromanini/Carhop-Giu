---
name: Protection extension pricing
description: Protection charges must preserve the original plan's daily rate across booking extensions.
---

Protection and rental amounts are cumulative totals, so dividing them by the current booking days becomes unreliable after an extension. New bookings should persist the exact daily protection and rental rates and every extension should reuse them; legacy bookings need a plan-aware fallback when they already contain extension history.

**Why:** A prior extension can change both cumulative totals and the booking day count, causing a later extension to charge an incorrect daily amount or zero when a snapshot is missing.

**How to apply:** Treat the vehicle's original daily rental rate and selected protection plan's original daily rate as the source of truth for all future extension billing and previews.