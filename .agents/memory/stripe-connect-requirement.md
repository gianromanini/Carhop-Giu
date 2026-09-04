---
name: Stripe Connect activation
description: Stripe Express onboarding cannot create connected accounts until Connect is enabled for the platform account.
---

Stripe Connect must be activated for the platform Stripe account before the application can create Express connected accounts and generate bank onboarding links.

**Why:** Stripe rejects `accounts.create({ type: "express" })` with a platform-activation error when Connect is unavailable; the Host UI otherwise only shows a loading state unless the error is surfaced.

**How to apply:** When onboarding fails before an account link is created, check Connect activation in the correct Stripe environment (development/test or production/live) before changing the Host login or bank form.