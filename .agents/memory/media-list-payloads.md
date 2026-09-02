---
name: Media list payloads
description: Performance rule for vehicle and other collection endpoints that include large uploaded media.
---

Collection endpoints must not embed large base64 media in list responses. Return lightweight metadata plus a dedicated, cacheable media URL; keep the original media available only through detail or media endpoints.

**Why:** A single uploaded photo can dominate response size, database transfer, serialization time, and browser startup even when the UI renders only one thumbnail.

**How to apply:** Use a summary projection for list queries, expose media availability/count, and load the requested original only when a card or detail view needs it. Preserve full media on detail and edit endpoints.