---
name: npm override re-resolution
description: How to handle stale nested package entries after adding a valid npm override.
---

When npm reports a nested dependency as both overridden and invalid, do not assume the override changed the installed or locked version. Re-resolve the transitive parent once, remove any temporary direct manifest entry, and verify both `npm ls` and `npm audit`.

**Why:** npm can retain a stale nested lockfile entry even after a scoped override is added and a normal install reports success.

**How to apply:** Use this only when the dependency tree shows the old physical version after installation. Keep the final parent transitive unless the application genuinely imports it directly.