---
name: Booking check-in media
description: Durable rule for displaying Host and Guest check-in information across booking detail views.
---

All booking detail views must use the complete booking response rather than the slim booking-list response before rendering check-in photos, gas, or mileage. The list response intentionally replaces large images with placeholders, while the individual booking response preserves the photo data. Host and Admin views show both Host and Guest check-in records, and the Guest receipt also shows both records with their separate gas and mileage values.

**Why:** Large photo payloads are intentionally stripped from list responses, and relying on list data caused missing photos and misleading “Unknown” values in booking details.

**How to apply:** When adding or changing any booking detail panel, call the full-booking fetch for the selected booking and render Host and Guest data from that full result.