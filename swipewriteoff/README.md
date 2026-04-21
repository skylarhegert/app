# SwipeWriteOff

SwipeWriteOff is a Tinder-style expense classification app designed for 1099 workers. It helps freelancers and independent contractors stay organized all year by classifying transactions as business or personal in seconds.

## Core product concept

- Connect a bank account and import transactions.
- Review each transaction one at a time in a swipe queue.
- Swipe right for business (deductible), swipe left for personal.
- Keep business and personal entries in separate repositories.
- Reclassify anything at any time.
- Auto-roll business totals into a visual Schedule C preview.
- Stay consistent with weekly reminder notifications.

## Features implemented in this prototype

1. **Onboarding flow**
   - User profile capture (name, email, profession).
2. **Bank sync simulation**
   - Imports seed transaction data and stores state locally.
3. **Swipe queue**
   - Right = business, left = personal.
   - Supports button actions and keyboard arrows.
4. **Repository management**
   - Separate business, personal, and unreviewed queues.
   - Move entries between repositories at any time.
   - Edit Schedule C category per transaction.
5. **Dashboard**
   - Total imports, reviewed count, deduction totals, estimated tax savings.
   - Weekly progress meter and queue snapshot.
6. **Schedule C visual**
   - Line-item style category table mapped to common Schedule C buckets.
7. **Reminder notifications**
   - Weekly day/time selection.
   - Browser notification permission flow + test notification.

## Tech stack

- React 19
- TypeScript
- Vite
- CSS (custom styling, responsive layout)
- LocalStorage for persistence

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Suggested next steps for full production app

1. **Authentication + security**
   - Add secure auth (OAuth or passwordless) and encrypted user sessions.
2. **Bank integration**
   - Replace mock sync with a provider such as Plaid, MX, or Teller.
3. **Real backend**
   - Persist users, transactions, classifications, and Schedule C mappings in a database.
4. **AI categorization**
   - Pre-label transactions and confidence-score them before user review.
5. **Tax export**
   - Export CSV/PDF compatible with accountant workflows and filing tools.
6. **Mobile-first app**
   - Add React Native or native iOS/Android client for true swipe-native UX.
7. **Compliance**
   - Add audit logs, data retention policies, privacy terms, and SOC2 controls.
