# ADBMS concepts -> where to find them in this project

Use this as a cheat-sheet when presenting your slides.

## Normalization & schema design (slide 7)
- `database/schema.sql`, section 1. Every table has a single-column primary key; non-key attributes depend only on the key (3NF).
  Bill totals are not stored redundantly by hand - `bill.total_amount` is maintained by trigger from `bill_item.line_total`, which is itself a **generated column** (`quantity * unit_price`).
- Patient, doctor, department, medicine, bed are separate entities linked by foreign keys (`ON DELETE RESTRICT/CASCADE` chosen per relationship).

## Constraints (slide 5)
- `CHECK` (gender, status values, `stock_qty >= 0`, `dob <= CURRENT_DATE`, `discharge_time >= admit_time`), `UNIQUE`, `NOT NULL`, `FOREIGN KEY`.
- **Partial unique indexes** enforce rules a plain UNIQUE cannot:
  - `uq_doctor_slot` - one *scheduled* appointment per doctor/date/time (no double booking)
  - `uq_active_admission_bed` / `uq_active_admission_patient` - a bed holds one active patient; a patient has one active admission

## Indexes (slide 5)
- Section 2 of `schema.sql`: B-tree indexes on search/join columns, a functional index `lower(full_name)`, a composite index `(doctor_id, appt_date)`, and the partial indexes above.
- Show the effect: `EXPLAIN ANALYZE SELECT * FROM patient WHERE lower(full_name) LIKE 'rahul%';`

## Views (slide 5)
`v_doctor_schedule`, `v_stock_alerts`, `v_bed_availability`, `v_patient_history` (uses `jsonb_agg`), `v_bill_summary`, `v_revenue_daily`.

## Stored procedures / functions (slide 5)
`book_appointment`, `admit_patient` (emergency auto-allocation with `FOR UPDATE SKIP LOCKED`), `discharge_patient` (discharge + bill in one atomic call), `generate_consultation_bill`, `add_prescription_charges`, `register_user`, `fn_dashboard_summary`.

## Triggers (slide 5)
| Trigger | Purpose |
|---|---|
| `trg_appt_validate` | working hours, no past slots, doctor must be active |
| `trg_prescription_stock` | deduct stock atomically; reject if insufficient/expired |
| `trg_admission_before/after` | lock + check bed, flip bed status on admit/discharge |
| `trg_bill_item_changed` | recompute bill total and status |
| `trg_payment_before/after` | block over-payment (locks the bill row), update status |
| `trg_audit_*` | write old/new row images (JSONB) to `audit_log` |

## Transactions - ACID (slide 7)
- **Atomicity:** `POST /api/records` (`backend/app/routers/clinical.py`) inserts a record and all its prescriptions in one transaction; one bad prescription rolls back the whole visit. Demo 5 in `concurrency_demo.sql`.
- **Consistency:** constraints + triggers keep totals, stock and bed status valid at commit time.
- **Isolation:** see below.
- **Durability:** PostgreSQL write-ahead log (WAL); see backup section.

## Concurrency control (slide 7)
PostgreSQL uses MVCC plus row-level two-phase locking for writers (locks are held until commit/rollback).
- `SELECT ... FOR UPDATE` in `fn_admission_before`, `fn_payment_before`, `discharge_patient` - lost-update prevention (demos 1 and 3).
- `SKIP LOCKED` in `admit_patient` - concurrent emergencies get different beds (demo 4).
- `SERIALIZABLE` isolation prevents phantom reads (demo 6).
- Automatic deadlock detection (demo 7).

**Be accurate in your viva:** PostgreSQL does not implement *timestamp ordering* as a concurrency protocol. Your slide mentions 2PL and timestamp ordering; the honest framing is "2PL-style row locking and MVCC snapshots (which are timestamp/transaction-id based) in PostgreSQL; timestamp ordering is the textbook alternative." Adjust the slide wording if your examiner is strict.

## Security (slide 7)
- **RBAC:** application level - `require_roles(...)` in `backend/app/auth.py`, mirrored by the role-based menu in `frontend/src/App.jsx`. Database level - `hms_*` roles and `GRANT`s at the end of `schema.sql`.
- **Row-Level Security:** `hms_patient` sees only its own appointments/bills (test block at the bottom of `concurrency_demo.sql`).
- **Encryption:** `patient.national_id_enc` uses `pgp_sym_encrypt` (AES, via pgcrypto); passwords use bcrypt (`crypt(..., gen_salt('bf'))`). Note: this encrypts selected columns; it is not whole-database encryption. Use disk/volume encryption for that.
- **Audit trail:** `audit_log` via `fn_audit()`.

## Backup & recovery (slide 7)
- Logical backups: `database/backup.sh` (`pg_dump -Fc`, `pg_restore`).
- Point-in-time recovery (PITR) is a PostgreSQL feature you configure on the server, not something this app code does:
  1. `wal_level = replica`, `archive_mode = on`, `archive_command = 'cp %p /archive/%f'`
  2. Take a base backup with `pg_basebackup`
  3. To recover: restore the base backup, set `restore_command` and `recovery_target_time = '2026-11-25 10:30:00'`, create `recovery.signal`, start the server.
- Your slide says "zero data loss"; more precisely, WAL archiving gives you recovery to any point up to the last archived segment (synchronous replication is needed to approach zero loss). Consider rewording.
