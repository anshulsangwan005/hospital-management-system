# Smart Hospital Management System

ADBMS course project (Bennett University) - a full-stack hospital system whose business rules
(double-booking prevention, stock deduction, bed allocation, billing totals, audit trail) are enforced
**inside PostgreSQL** with triggers, stored functions, constraints and locking.

| Layer | Tech (all free / open source) |
|-------|-------------------------------|
| UI | React 18, Vite, Tailwind CSS, role-based navigation |
| API | Python 3.10+, FastAPI, psycopg2, JWT (python-jose) |
| Database | PostgreSQL 16 (+ `pgcrypto` for AES encryption and bcrypt) |
| Infra | Docker Compose (optional - or install Postgres yourself) |

## Project layout

```
hospital-management-system/
├── docker-compose.yml          # free local PostgreSQL (auto-loads schema + seed)
├── database/
│   ├── schema.sql              # tables, constraints, indexes, views, functions, triggers, roles, RLS
│   ├── seed.sql                # demo data + demo users
│   ├── concurrency_demo.sql    # 2PL / locking / isolation / deadlock demos for your viva
│   └── backup.sh               # pg_dump backup / restore helper
├── backend/                    # FastAPI app (app/main.py, auth.py, db.py, routers/*)
├── frontend/                   # React + Tailwind app (src/pages/*)
└── docs/ADBMS_CONCEPTS.md      # maps every slide concept to the exact file/line to show
```

## Quick start

You need: **Docker**, **Python 3.10+**, **Node 18+** (all free).

### 1. Database
```bash
docker compose up -d db
```
First start creates all tables and loads demo data. To reset everything:
`docker compose down -v && docker compose up -d db`.

*No Docker?* Install PostgreSQL, then:
```bash
createdb hospital
psql -d hospital -f database/schema.sql
psql -d hospital -f database/seed.sql
```
and set `DATABASE_URL` in `backend/.env` to match.

### 2. Backend (http://localhost:8000, docs at /docs)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env
uvicorn app.main:app --reload
```
Open http://localhost:8000/docs for the interactive Swagger UI.

### 3. Frontend (http://localhost:5173)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Everything in containers (optional)
```bash
docker compose --profile full up --build     # UI on http://localhost:8080
```

## Demo accounts

| Username | Password | Role | Can access |
|----------|----------|------|-----------|
| admin | admin123 | Admin | everything |
| doctor1 | doctor123 | Doctor | patients, own appointments, records, prescriptions |
| reception | reception123 | Receptionist | patients, appointments, beds, billing |
| pharma | pharma123 | Pharmacist | pharmacy inventory |
| patient1 | patient123 | Patient | own appointments and bills |

**Change these passwords and the `JWT_SECRET` / `ENC_KEY` values before any real deployment.**

## Things to try (good for a demo)

1. Log in as `reception`, book two appointments for the same doctor and time - the second is rejected by the database.
2. Log in as `doctor1`, open a patient's history, add a record and prescribe *Ibuprofen* with quantity 50 - the whole visit rolls back (only 8 in stock). Prescribe a smaller quantity and watch stock drop.
3. As `reception`, admit a patient with *Emergency* ticked and no bed chosen - a free Emergency/ICU bed is auto-assigned. Discharge them: a bed-charge bill is generated.
4. Open the bill, try to pay more than the balance (rejected), then pay in parts and watch the status go Pending -> Partial -> Paid.
5. As `pharma`, see low-stock and expiring-soon alerts (from the `v_stock_alerts` view).
6. Run the two-terminal scenarios in `database/concurrency_demo.sql`.

## Backup & recovery

```bash
./database/backup.sh backup
./database/backup.sh restore backups/<file>.dump
```
For point-in-time recovery (WAL archiving + `recovery_target_time`) see `docs/ADBMS_CONCEPTS.md`.

## Free hosting options (free tiers change - check current limits)

- **Database:** Neon, Supabase, or Aiven free Postgres (run `schema.sql` then `seed.sql` in their SQL console; `pgcrypto` is available on all three)
- **API:** Render or Railway free/trial tier (set `DATABASE_URL`, `JWT_SECRET`, `ENC_KEY`, `CORS_ORIGINS`)
- **UI:** Vercel, Netlify or Cloudflare Pages (build `npm run build`, env `VITE_API_URL=https://<your-api>/api`)

## Notes / honest limitations

- This is a coursework-grade system. A real hospital deployment would need HTTPS, stricter secrets management, rate limiting, formal privacy-compliance review, and proper pen-testing.
- The API connects with one database user (the table owner), so the PostgreSQL roles and RLS policies in `schema.sql` are demonstrated via `SET ROLE` rather than enforced per request; per-request enforcement is done in the API (JWT + role checks).
- Lab reports, IoT vitals, mobile apps and AI features from your "Future Scope" slide are intentionally not included.
