---
name: Vendor context provider order
description: VendorProvider calls useAuth so it must be nested inside AuthProvider
---

VendorProvider calls useAuth() to auto-set the vendorId from the logged-in user.
This means VendorProvider MUST be a descendant of AuthProvider in the React tree.

**Why:** React contexts are consumed from parent providers; calling useAuth outside its provider throws at render time.

**How to apply:** In vendor-app App.tsx, always nest: `<AuthProvider><VendorProvider>...</VendorProvider></AuthProvider>`.
HMR "Could not Fast Refresh" warnings on context hook files (useAuth, useVendor) are cosmetic — they trigger a full page reload instead of hot-swap, which is fine.
