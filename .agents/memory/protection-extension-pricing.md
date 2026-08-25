---
name: Protection extension pricing
description: Protection charges must preserve the original plan's daily rate across booking extensions.
---

The protection amount is a cumulative total, so dividing it by the current booking days becomes unreliable after an extension. New bookings should persist the exact daily protection rate and every extension should reuse it; legacy bookings need a plan-aware fallback when they already contain extension history.

**Why:** A prior extension can change both the protection total and the booking day count, causing a second extension to charge an incorrect daily amount.

**How to apply:** Treat the selected plan and its original daily rate as the source of truth for all future extension billing and previews.