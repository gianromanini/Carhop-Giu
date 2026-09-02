---
name: Booking approval gate
description: Durable rules for the pre-payment host/admin approval lifecycle.
---

New bookings must be created as pending requests without a payment intent. A pending request must not be treated as an active/reserved rental in vehicle availability; approval and payment are separate transitions.

**Why:** Hosts need to release a vehicle only after confirming it is available, and another booking can become active between approval and checkout.

**How to apply:** Keep approval restricted to the assigned host or an admin, revalidate date overlap at approval and immediately before payment activation, and keep declined requests non-activatable with no payment collected.