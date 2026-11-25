-- =====================================================================
-- Concurrency control & transaction demos  (open TWO psql sessions)
--   docker compose exec db psql -U hms -d hospital
-- =====================================================================

-- ---------------------------------------------------------------------
-- DEMO 1: Lost update prevention with row locks (2PL: SELECT ... FOR UPDATE)
-- ---------------------------------------------------------------------
-- Session A:
BEGIN;
SELECT stock_qty FROM medicine WHERE med_id = 1 FOR UPDATE;   -- lock acquired
UPDATE medicine SET stock_qty = stock_qty - 10 WHERE med_id = 1;
-- (do NOT commit yet)

-- Session B (will BLOCK until A finishes):
BEGIN;
SELECT stock_qty FROM medicine WHERE med_id = 1 FOR UPDATE;   -- waits...
-- Session A:  COMMIT;   -> Session B now sees the updated value, no lost update
-- Session B:  COMMIT;

-- ---------------------------------------------------------------------
-- DEMO 2: Double booking is impossible (partial unique index)
-- ---------------------------------------------------------------------
-- Run in both sessions at the same time:
SELECT book_appointment(4, 2, CURRENT_DATE + 3, '14:00', 'Knee pain');
-- One succeeds; the other fails with "This time slot is already booked".

-- ---------------------------------------------------------------------
-- DEMO 3: Two admissions racing for one bed
-- ---------------------------------------------------------------------
-- Session A:
BEGIN; SELECT admit_patient(4, 1, 'Observation', false);   -- bed G-01 locked
-- Session B:
BEGIN; SELECT admit_patient(5, 1, 'Observation', false);   -- blocks, then fails: bed not available
-- Session A: COMMIT;   Session B: ROLLBACK;

-- ---------------------------------------------------------------------
-- DEMO 4: Emergency admission uses SKIP LOCKED -> concurrent ER cases
--         automatically receive different beds instead of waiting
-- ---------------------------------------------------------------------
BEGIN; SELECT admit_patient(2, NULL, 'Accident', true);    -- gets ER-01
-- other session:
BEGIN; SELECT admit_patient(5, NULL, 'Cardiac arrest', true); -- gets ER-02, no waiting

-- ---------------------------------------------------------------------
-- DEMO 5: Atomicity - failed prescription rolls the whole visit back
-- ---------------------------------------------------------------------
BEGIN;
INSERT INTO medical_record(patient_id, doctor_id, diagnosis) VALUES (1, 1, 'Hypertension') RETURNING record_id;
INSERT INTO prescription(record_id, med_id, quantity, dosage) VALUES (currval('medical_record_record_id_seq'), 4, 999, '1 daily');
-- ERROR: Medicine 4 is out of stock, insufficient, or expired
ROLLBACK;
SELECT count(*) FROM medical_record WHERE diagnosis = 'Hypertension';   -- 0

-- ---------------------------------------------------------------------
-- DEMO 6: Isolation levels / phantom reads
-- ---------------------------------------------------------------------
-- Session A:
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT count(*) FROM appointment WHERE doctor_id = 1 AND appt_date = CURRENT_DATE + 1;
-- Session B: insert a new appointment for doctor 1 on that date and COMMIT.
-- Session A: re-run the SELECT -> same count (no phantom). Under READ COMMITTED it would change.
COMMIT;

-- ---------------------------------------------------------------------
-- DEMO 7: Deadlock detection (PostgreSQL aborts one victim automatically)
-- ---------------------------------------------------------------------
-- Session A: BEGIN; UPDATE medicine SET stock_qty = stock_qty WHERE med_id = 1;
-- Session B: BEGIN; UPDATE medicine SET stock_qty = stock_qty WHERE med_id = 2;
-- Session A: UPDATE medicine SET stock_qty = stock_qty WHERE med_id = 2;   -- waits
-- Session B: UPDATE medicine SET stock_qty = stock_qty WHERE med_id = 1;   -- ERROR: deadlock detected

-- ---------------------------------------------------------------------
-- Handy checks
-- ---------------------------------------------------------------------
SELECT * FROM v_stock_alerts;
SELECT * FROM v_bed_availability;
SELECT * FROM audit_log ORDER BY log_id DESC LIMIT 10;
-- Decrypt a patient's national ID (needs the key):
SELECT full_name, pgp_sym_decrypt(national_id_enc, 'change-this-encryption-key') AS national_id
  FROM patient WHERE national_id_enc IS NOT NULL;
-- Test row-level security:
BEGIN; SET LOCAL ROLE hms_patient; SET LOCAL app.patient_id = '1';
SELECT * FROM appointment;          -- only patient 1's rows
ROLLBACK;
