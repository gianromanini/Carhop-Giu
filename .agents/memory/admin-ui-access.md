---
name: Admin UI access
description: Rule for gating admin-only controls when the app supports more than one administrative login path.
---

Admin-only controls must use the unified admin viewer state, which combines every supported administrative authentication path. Do not gate a control solely with the legacy password-session flag.

**Why:** An authenticated administrator can enter through the application identity provider without setting the older local admin-session flag, leaving controls visible but disabled.

**How to apply:** Reuse the shared admin viewer boolean for rendering, enabling, required fields, and payload ownership decisions in admin vehicle and fleet forms.