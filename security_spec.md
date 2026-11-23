# Security Specification & Adversarial Threat Model: Toolpotro Creators Network

## 1. Core Data Invariants & Zero-Trust Policies
1. **User Balance Integrity:** Regular creators CANNOT modify their `availableBalance`, `pendingBalance`, `totalEarned`, or `role` via client writes. Only backend server logic or verified Admin accounts can modify financial ledgers.
2. **Wallet Binding Protection:** Users can only update their own profile document (`/users/{userId}` where `userId == request.auth.uid`), and during profile updates, can ONLY alter `walletProvider`, `walletNumber`, `displayName`, and `photoURL`.
3. **Submission State Immutability:** Creators cannot tamper with verification fields (`status`, `views`, `likes`, `comments`, `geminiConfidence`, `calculatedPayout`, `finalPayout`). Only initial creation with status='pending' is permitted, or backend processing updates.
4. **Deduplication & Anti-Spam:** Submissions must have legitimate URLs, bounded string sizes, and immutable `userId` and `createdAt` timestamps.
5. **Campaign Access Controls:** Only Admins can create or update campaign definitions (CPM rates, validation rules, keywords). All authenticated users can read active campaigns.
6. **Admin Authorization Guard:** Admin privileges require an existing document in `/admins/{uid}` or verification against the bootstrapped admin email `anglaranni66@gmail.com`.

---

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Ghost Balance Escalation:** Creator attempts to set `availableBalance: 999999` directly via client SDK.
2. **Role Tampering:** Creator updates their document with `role: "admin"`.
3. **Status Shortcutting:** Creator submits a video directly with `status: "approved"` and `finalPayout: 5000`.
4. **Identity Spoofing:** Creator submits a video with `userId: "another_user_uid"`.
5. **Denial-of-Wallet Long Payload:** Attacker sends a 500KB string into `originalUrl` or `walletNumber`.
6. **Campaign Rule Hijack:** Non-admin attempts to lower `minViews` or increase `cpmRate` on `/campaigns/{campaignId}`.
7. **Malicious Path Injection:** Attacker injects special characters or directory traversal strings into document path IDs.
8. **Shadow Field Injection:** Creator submits additional ghost fields (`isAdmin: true`, `bypassReview: true`).
9. **Fake Timestamp Tampering:** Client supplies a spoofed historical timestamp for `createdAt`.
10. **Terminal State Re-writing:** Attacker tries to alter a video already marked as `approved` or `rejected`.
11. **PII Scraping:** Unauthenticated user tries to list all user documents and scrape phone numbers.
12. **Fake Admin Impersonation:** Attacker with unverified email attempts to bypass admin checks.

---

## 3. Defense Blueprint
All rules strictly enforce type checks, string size boundaries, authorization checks, and attribute allowlisting.
