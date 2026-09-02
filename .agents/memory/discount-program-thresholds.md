---
name: Discount program thresholds
description: The boundary rule used when applying vehicle duration discounts.
---

A discount program configured with a minimum-day threshold of X applies only when the rental duration is greater than X days, not when it is exactly X.

**Why:** The product requirement describes these offers as applying above a number of days, so the boundary must remain explicit and consistent across checkout and extensions.

**How to apply:** Use the same strict threshold rule for client totals, server-side extension recalculation, and any future pricing tests or UI copy.