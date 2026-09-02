---
name: Web Push key handling
description: Operational rule for VAPID keys and background notification availability
---

VAPID public and private keys must be stored as server Secrets and never printed in chat, logs, or client bundles. Web Push configuration should fail closed: invalid or missing keys disable background push while the rest of CarHopGo continues to start.

**Why:** A private VAPID key is server credential material, and a malformed key must not make booking and rental operations unavailable.

**How to apply:** Keep the public key exposed only through the push configuration endpoint after server validation. Re-run the workflow after changing Secrets, then validate the configured status and a logged-in subscription.