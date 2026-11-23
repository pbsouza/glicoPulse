# Security Specification — GlicoPulse Firestore Rules

## 1. Data Invariants
1. **Master Authority**: Only the verified email `belchior87@gmail.com` (`request.auth.token.email == 'belchior87@gmail.com' && request.auth.token.email_verified == true`) holds `master` authority to list all `/users` documents and change any user's `status` (`pending` | `approved` | `denied`) or `role`.
2. **Self-Registration Guard**: A newly authenticated regular user may only create `/users/{request.auth.uid}` with `role: 'user'` and `status: 'pending'`, and verified `email == request.auth.token.email`.
3. **RBAC Immutability**: Non-master users may never modify `role`, `status`, `uid`, `email`, or `createdAt` on `/users/{userId}`.
4. **PII Isolation**: Only the document owner (`request.auth.uid == userId`) or the verified master (`belchior87@gmail.com`) may `get` `/users/{userId}`. Only the verified master may `list` `/users`.
5. **Approval Gate on Clinical Subcollections**: Reads (`get`), creates, updates, and deletes on `/users/{userId}/entries`, `/users/{userId}/schedules`, and `/users/{userId}/settings` require the user to be the verified owner AND have `status == 'approved'` on `/users/{userId}` (or be the verified master).
6. **Strict Schema & Bounds**: Every collection validates required keys, disallows undeclared shadow keys (`hasOnly`), enforces string `.size()` limits, numeric ranges, regex patterns, and server timestamps (`request.time`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Approval Escalation**: Regular user creates `/users/{uid}` with `status: "approved"`. Expected: `PERMISSION_DENIED`.
2. **Self-Master Role Escalation**: Regular user creates `/users/{uid}` with `role: "master"`. Expected: `PERMISSION_DENIED`.
3. **Update-Gap Privilege Escalation**: Pending/denied user updates `/users/{uid}` to set `status: "approved"`. Expected: `PERMISSION_DENIED`.
4. **Shadow Field Injection**: Approved user creates a `GlucoseEntry` with extra field `isVerified: true`. Expected: `PERMISSION_DENIED`.
5. **Email Spoofing (Unverified Email)**: User with `email: "belchior87@gmail.com"` and `email_verified: false` tries to list `/users`. Expected: `PERMISSION_DENIED`.
6. **Cross-User PII Read**: Non-master user attempts `get` on `/users/{otherUid}` or `list` on `/users`. Expected: `PERMISSION_DENIED`.
7. **Pending/Denied User Clinical Write**: User with `status: "pending"` or `"denied"` tries to create `/users/{uid}/entries/{entryId}`. Expected: `PERMISSION_DENIED`.
8. **ID Poisoning**: User attempts to create `/users/{uid}/entries/bad..id$123` or a 500-char ID. Expected: `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: User creates a `GlucoseEntry` with a backdated `createdAt` (`!== request.time`). Expected: `PERMISSION_DENIED`.
10. **Immutable Ownership Tampering**: User updates a `GlucoseEntry` attempting to change `uid` or `createdAt`. Expected: `PERMISSION_DENIED`.
11. **Value Range Poisoning**: User creates a `GlucoseEntry` with `value: 99999` or `notes` > 500 chars. Expected: `PERMISSION_DENIED`.
12. **Master Self-Lockout**: Master attempts to delete their own `/users/{masterUid}` doc. Expected: `PERMISSION_DENIED`.
