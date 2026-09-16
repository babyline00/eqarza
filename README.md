# E-Qarza — Pakistani Mobile Loan App

A complete mobile-first loan providing application for the Pakistani market, built with Next.js 16, TypeScript, Prisma, and Tailwind CSS.

## Features

### User App (Mobile-First)
- **Phone + OTP Login** — Pakistani phone format (03XXXXXXXXX) with 4-digit OTP
- **5-Step KYC Wizard** — Personal info, CNIC, address, employment, existing loans, reference
- **Loan Eligibility** — Auto-calculated tiers based on monthly income:
  - Up to Rs. 25,000 income → Rs. 4,000 loan
  - Rs. 25,000–50,000 → Rs. 8,000 loan
  - Rs. 50,000–100,000 → Rs. 18,000 loan
  - Rs. 100,000–200,000 → Rs. 26,000 loan
  - Above Rs. 200,000 → Rs. 55,000 loan
- **Withdrawal Account** — JazzCash / EasyPaisa / Bank (20 Pakistani banks)
- **10% Security Downpayment** — Upload screenshot proof, admin verifies
- **4 Weekly Installments** — Pay 1st installment to unlock withdrawal
- **Notifications** — Weekly reminders, approval alerts

### Admin Panel (Mobile-Friendly)
- **Dashboard** — Stats: total loans, active loans, pending payments, total disbursed
- **Downpayment Approvals** — View proof, approve/reject with notes
- **Installment Confirmations** — Confirm installment proofs as paid
- **All Loans** — Searchable list with detail modal
- **Users** — Searchable list with KYC details and loan history
- **Bottom Navigation** — Mobile-friendly tab switching

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Database**: Prisma ORM + SQLite
- **State**: Zustand (with persist middleware)
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod

## Setup Instructions

### 1. Install dependencies
```bash
bun install
# or
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` to set your `DATABASE_URL` (default: `file:./db/custom.db`).

### 3. Initialize database
```bash
bun run db:push
bun run scripts/seed.ts
```

This creates the admin user:
- Username: `admin`
- Password: `admin123`

### 4. Run development server
```bash
bun run dev
# or
npm run dev
```

Open http://localhost:3000

### 5. Build for production
```bash
bun run build
bun run start
```

## Project Structure

```
.
├── prisma/
│   └── schema.prisma          # Database models
├── public/
│   ├── uploads/               # User-uploaded payment proofs
│   └── logo.svg
├── scripts/
│   └── seed.ts                # Admin user seeder
├── src/
│   ├── app/
│   │   ├── api/               # 16 API endpoints
│   │   │   ├── auth/          # send-otp, verify-otp
│   │   │   ├── user/          # me, kyc
│   │   │   ├── loan/          # eligibility, select, withdrawal-account, downpayment, installment
│   │   │   ├── admin/         # login, loans, users, approve-downpayment, reject-downpayment, confirm-installment
│   │   │   ├── notifications/
│   │   │   └── upload/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx           # Single-page router
│   ├── components/
│   │   ├── phone-frame.tsx    # Mobile frame + Admin frame wrappers
│   │   ├── screens/           # 10 screen components
│   │   │   ├── login.tsx
│   │   │   ├── kyc.tsx
│   │   │   ├── eligibility.tsx
│   │   │   ├── withdrawal.tsx
│   │   │   ├── downpayment.tsx
│   │   │   ├── first-installment.tsx
│   │   │   ├── dashboard.tsx
│   │   │   ├── notifications.tsx
│   │   │   ├── admin-login.tsx
│   │   │   └── admin-dashboard.tsx
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── auth.ts            # OTP/password utilities, loan tiers, Pakistani banks
│   │   ├── config.ts          # Platform config (deposit accounts, company info)
│   │   ├── db.ts              # Prisma client
│   │   ├── session.ts         # getUserFromReq, getAdminFromReq helpers
│   │   ├── store.ts           # Zustand auth store + API helper
│   │   └── utils.ts
│   └── hooks/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## API Endpoints

### Auth
- `POST /api/auth/send-otp` — Send OTP to phone (returns OTP in response for demo)
- `POST /api/auth/verify-otp` — Verify OTP, return session token

### User
- `GET /api/user/me` — Get current user with KYC + loans
- `POST /api/user/me` — Update basic info
- `GET /api/user/kyc` — Get KYC
- `POST /api/user/kyc` — Save/update KYC

### Loan
- `GET /api/loan/eligibility` — Get eligible loan amounts based on income
- `POST /api/loan/select` — Select a loan amount
- `GET /api/loan/select` — Get current loan
- `POST /api/loan/withdrawal-account` — Save withdrawal account details
- `POST /api/loan/downpayment` — Upload downpayment proof
- `POST /api/loan/installment` — Upload installment proof

### Admin (requires admin token)
- `POST /api/admin/login` — Admin login
- `GET /api/admin/loans` — All loans with stats
- `GET /api/admin/users` — All users
- `POST /api/admin/approve-downpayment` — Approve downpayment (creates 4 installments)
- `POST /api/admin/reject-downpayment` — Reject downpayment
- `POST /api/admin/confirm-installment` — Confirm installment as paid (unlocks withdrawal if 1st)

### Other
- `GET /api/notifications` — Get user notifications (auto-creates weekly reminders)
- `POST /api/notifications` — Mark notification as read
- `POST /api/upload` — Upload file (returns URL)

## Loan Workflow

1. User registers with phone + OTP
2. User completes 5-step KYC
3. User sees eligible loan amounts based on income
4. User selects loan amount → loan record created (status: `DOWNPAYMENT_PENDING`)
5. User sets withdrawal account (JazzCash/EasyPaisa/Bank)
6. User pays 10% security downpayment + uploads screenshot proof
7. **Admin reviews & approves** downpayment → 4 weekly installments auto-created (status: `FIRST_INSTALLMENT_PENDING`)
8. User pays 1st installment + uploads proof
9. **Admin confirms** installment → withdrawal unlocked (status: `ACTIVE`, `withdrawalUnlocked: true`)
10. User can withdraw loan amount to registered account
11. User pays remaining 3 installments weekly
12. When all 4 installments paid → loan `COMPLETED`

## Status Flow

```
DRAFT → DOWNPAYMENT_PENDING → FIRST_INSTALLMENT_PENDING → ACTIVE → COMPLETED
                          ↘ REJECTED (admin rejected downpayment)
```

## Demo Credentials

- **Admin**: username `admin`, password `admin123`
- **User**: Any Pakistani phone number (03XXXXXXXXX), OTP shown in toast notification

## Production Notes

- Replace SQLite with PostgreSQL/MySQL
- Integrate real SMS gateway (Twilio, JazzCash SMS API) for OTP
- Use JWT tokens instead of passwordHash-as-session
- Add cron job for automatic weekly reminders (currently triggered on notifications API call)
- Add rate limiting on OTP send endpoint
- Add file upload validation (virus scan, image dimension checks)
- Add proper logging and monitoring

## License

MIT — Free to use for educational and commercial purposes.
