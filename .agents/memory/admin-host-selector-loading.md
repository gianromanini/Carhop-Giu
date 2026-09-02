---
name: Admin host selector loading
description: Prevent empty pre-authentication reference data from being reused by Admin-only selectors.
---

Admin-only reference lists should be enabled only after the unified Admin viewer state is true and should refresh when the Admin form becomes available.

**Why:** A request made for an unauthenticated visitor can complete with an empty result during startup and remain in the client cache, making a later Admin selector appear to have no registered options.

**How to apply:** Gate Admin-only list queries with the shared Admin viewer boolean and use a fresh mount/activation fetch for forms that assign records to Hosts.