---
name: Discount program thresholds
description: The boundary rule used when applying vehicle duration discounts.
---

A discount program configured on a vehicle with a minimum-day threshold of X applies only when the rental duration is greater than X days, not when it is exactly X. Each vehicle is independent; a vehicle without configured programs receives no progressive discount.

**Why:** Hosts create the discount table per vehicle, so applying a platform-wide fallback can discount a vehicle that the Host never configured.

**How to apply:** Keep the “more than X days” rule, apply only the selected vehicle's configured programs, and calculate extension discounts from the current total duration minus the discount already stored on the booking.