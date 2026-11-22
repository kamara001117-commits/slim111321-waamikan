# WAAMIKAN Enterprise Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Strict RBAC & Verified Identity**: Only verified Google accounts (`request.auth.token.email_verified == true`) with an authorized role (`super_admin`, `admin`, `staff`, `finance_manager`, `inventory_manager`, `sales_staff`, `hr_staff`) in `/users/{uid}` or a bootstrapped super-admin email (`marufadam7777@gmail.com`, `waamikan@gmail.com`) may access ERP/admin collections.
2. **No Self-Assigned Privilege Escalation**: A newly registered user creating `/users/{uid}` can only assign `role: 'user'`, unless their verified email is in the super-admin allowlist (`super_admin`) or matches an active `/staff_invites/{emailLower}` record. Users cannot modify their own `role` or `uid` on update.
3. **PII Isolation**: User profiles (`/users`), staff invites (`/staff_invites`), customers (`/customers`), employees (`/employees`), payslips (`/payslips`), payroll (`/payroll`), CRM requests (`/requests`), and web orders (`/web_orders`) restrict reads strictly to owners or verified staff—never blanket `isSignedIn()`.
4. **Public Storefront vs. Financial Ledger Boundary**: Unauthenticated visitors and standard customers cannot write directly to `invoices`, `customers`, `products`, `accounts`, or `journal_entries`. Public checkout writes only to `web_orders` with `status == 'pending'`; staff explicitly review and convert orders to `invoices`.
5. **Immutable Audit & Ownership Fields**: `createdAt`, `uid` (on users), and `userId` (on orders/invoices where set) cannot be reassigned after creation.
6. **Strict Schema & Payload Size Limits (Anti-Shadow / Denial-of-Wallet)**: Every `create` and `update` validates allowed keys, types, enums, and `.size()` bounds on strings/arrays. Document IDs are validated with `isValidId()` (`^[a-zA-Z0-9_\-]+$`, max 128 chars) or `isValidEmailId()` for `/staff_invites/{inviteEmail}`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Admin Registration Spoof (`users/{uid}`)**: Authenticated user writes `{ uid: auth.uid, email: auth.email, role: "super_admin" }` when not on allowlist and no invite exists -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof (`users/{uid}`)**: Unverified token (`email_verified: false`) attempting super-admin write -> `PERMISSION_DENIED`.
3. **Privilege Escalation Shadow Update (`users/{uid}`)**: Existing `'user'` updates `{ role: "admin" }` or injects ghost field `{ isRoot: true }` -> `PERMISSION_DENIED`.
4. **Cross-User Profile Read (`users/{otherUid}`)**: Standard `'user'` attempts `get` on another user's profile or `list` on `/users` -> `PERMISSION_DENIED`.
5. **Unauthenticated Invoice Forgery (`invoices/{id}`)**: Anonymous/standard user creates an invoice directly (`total: 0, status: "paid"`) -> `PERMISSION_DENIED`.
6. **Web Order State Shortcutting (`web_orders/{id}`)**: Shopper submits `web_orders` with `status: "invoiced"` instead of `"pending"` -> `PERMISSION_DENIED`.
7. **Web Order Cross-User Impersonation (`web_orders/{id}`)**: Signed-in user A submits a `web_order` with `userId: "user_B"` -> `PERMISSION_DENIED`.
8. **Product Price/Stock Tampering (`products/{id}`)**: Non-admin/customer updates `price: 0.01` on a medical device -> `PERMISSION_DENIED`.
9. **Financial Journal Tampering (`journal_entries/{id}`)**: Non-admin staff updates a posted journal entry or injects a 200-line/unbounded payload -> `PERMISSION_DENIED`.
10. **ID Poisoning Attack (`products/{1500_char_junk}`)**: Attempting write with a 1500-char or slash-injected document ID -> `PERMISSION_DENIED`.
11. **Oversized Message / DoW Attack (`requests/{id}`)**: Public contact form submission with 100KB `message` string or ghost field `{ adminNote: "hacked" }` -> `PERMISSION_DENIED`.
12. **Blanket CRM/Customer Scrape (`customers`, `employees`)**: Standard `'user'` attempting `list` or `get` on `/customers` or `/employees` -> `PERMISSION_DENIED`.
