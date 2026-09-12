---
name: Discount program thresholds
description: The boundary rule used when applying vehicle duration discounts.
---

A custom discount program configured with a minimum-day threshold of X applies only when the rental duration is greater than X days, not when it is exactly X. Vehicles without custom programs use the weekly defaults: 10% through 7 days, 15% from 8–20 days, and 20% from 21 days onward.

**Why:** Existing custom offers describe thresholds as “more than” a number of days, while the current weekly default policy defines explicit inclusive bands and must also recalculate downward when a booking is reduced.

**How to apply:** Keep custom-program behavior strict, apply weekly defaults only when no custom programs exist, and calculate extension discounts from the current total duration minus the discount already stored on the booking.