---
name: Discount program thresholds
description: The boundary rule used when applying vehicle duration discounts.
---

A discount program configured on a vehicle with a minimum-day threshold of X applies only when the rental duration is greater than X days, not when it is exactly X. Each vehicle is independent; a vehicle without configured programs receives no progressive discount.

**Why:** Hosts create the discount table per vehicle, so applying a platform-wide fallback can discount a vehicle that the Host never configured.

**How to apply:** Keep the “more than X days” rule and apply only the selected vehicle's configured programs. For an extension, run the table against the added days only; preserve the booking's existing discount and add the extension discount separately.

**Why:** An extension charge represents only the newly selected days. Recalculating against the full booking duration can apply a large historical discount to the new charge and produce an incorrect total.