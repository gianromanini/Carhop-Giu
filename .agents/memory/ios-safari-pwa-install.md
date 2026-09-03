---
name: iOS Safari PWA installation
description: The platform limitation and user guidance required to install CarHop Go from Safari on iPhone and iPad.
---

iOS Safari does not expose a supported API that lets a website install a PWA directly after a button click. The reliable flow is to guide the user through Safari's Share button, “Add to Home Screen,” and then “Add.”

**Why:** The native `beforeinstallprompt` flow is not available in iOS Safari, so a confirmation button cannot complete installation by itself.

**How to apply:** Detect iOS Safari separately from other browsers and show concise, in-app instructions after the user confirms the install request. Do not promise automatic installation.