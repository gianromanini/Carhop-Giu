---
name: Notification channel safety
description: Durable rules for notification delivery when an external SMS provider is not connected
---

SMS notifications must remain opt-in and provider-backed. If the deployment has no configured SMS provider, the app should skip SMS explicitly, expose that status to Admin, and never create a fake success event.

**Why:** A simulated SMS creates false operational confidence and can cause Hosts to miss time-sensitive booking changes.

**How to apply:** Keep browser/PWA and email notifications independent from SMS. Add a provider only through an approved integration or a configured server-side webhook, and report partial delivery honestly.