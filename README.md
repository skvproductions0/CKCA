# CK CAREER ACADEMY

Production-oriented **offline-first** school management desktop app for Windows, built with **Electron**, **React**, **TypeScript**, **SQLite**, and **Prisma**.

## Features

- Secure login with role-based access (Super Admin, Principal, Accountant, Teacher, Receptionist)
- Dashboard with statistics and charts (Recharts)
- Student management, profiles, search, and admissions
- Classes, sections, teachers, subjects
- Fee structures, payments, receipts (PDF), payment history
- Attendance marking and reports
- Examinations, results entry, grading
- Reports with CSV export and print
- Notifications, audit log, backup & restore
- Configurable school settings (name, logo path, footers, etc.)

## Prerequisites

- Node.js 18+ and npm
- Windows (for `.exe` packaging)

## Setup

```bash
cd "CK CAREER ACADEMY"
npm install
npm run db:setup
```

`db:setup` runs Prisma generate, pushes the schema to SQLite, and seeds demo data.

## Development

Compile the Electron main/preload process, then start Vite and Electron:

```bash
npm run electron:dev
```

Use the **Electron window** (not the browser alone) so `window.api` IPC works.

### Demo logins

| Username   | Password | Role         |
| ---------- | -------- | ------------ |
| admin      | admin123 | Super Admin  |
| principal  | admin123 | Principal    |
| accountant | admin123 | Accountant   |
| teacher1   | admin123 | Teacher      |
| reception  | admin123 | Receptionist |

## Build Windows installer

```bash
npm run electron:build
```

Output is under `release/`.

## Project structure

- `src/` — React UI (pages, components, contexts)
- `electron/` — Main process and preload (secure IPC)
- `server/` — Business logic and database access
- `prisma/` — Schema and seed

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- Passwords hashed with bcrypt
- Financial records use integer paise for amounts

## Database

Development database: `prisma/dev.db`  
Production (packaged app): `%APPDATA%/School Management System/database/school.db`

## License

MIT
