-- =====================================================================
-- Smart Hospital Management System  |  PostgreSQL 14+ schema
-- Run on an EMPTY database. (docker-compose does this automatically.)
-- Covers: tables, constraints, indexes, views, functions/procedures,
--         triggers, transactions/locking, encryption, RBAC, RLS, audit.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- AES encryption + bcrypt hashing

-- ---------------------------------------------------------------------
-- 1. TABLES (3NF/BCNF) with PK / FK / CHECK / UNIQUE constraints
-- ---------------------------------------------------------------------
CREATE TABLE department (
    dept_id     SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    location    VARCHAR(100)
);

CREATE TABLE doctor (
    doctor_id        SERIAL PRIMARY KEY,
    full_name        VARCHAR(120) NOT NULL,
    specialization   VARCHAR(100) NOT NULL,
    phone            VARCHAR(20),
    email            VARCHAR(120) UNIQUE,
    dept_id          INT NOT NULL REFERENCES department(dept_id) ON DELETE RESTRICT,
    consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 500 CHECK (consultation_fee >= 0),
    active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE patient (
    patient_id       SERIAL PRIMARY KEY,
    full_name        VARCHAR(120) NOT NULL,
    dob              DATE NOT NULL CHECK (dob <= CURRENT_DATE),
    gender           CHAR(1) NOT NULL CHECK (gender IN ('M','F','O')),
    phone            VARCHAR(20),
    email            VARCHAR(120),
    address          TEXT,
    blood_group      VARCHAR(3) CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    national_id_enc  BYTEA,                         -- AES-encrypted (pgp_sym_encrypt)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointment (
    appt_id     SERIAL PRIMARY KEY,
    patient_id  INT NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    doctor_id   INT NOT NULL REFERENCES doctor(doctor_id)   ON DELETE RESTRICT,
    appt_date   DATE NOT NULL,
    appt_time   TIME NOT NULL,
    status      VARCHAR(12) NOT NULL DEFAULT 'Scheduled'
                CHECK (status IN ('Scheduled','Completed','Cancelled','No-Show')),
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Prevents double booking even under concurrent inserts (race-proof)
CREATE UNIQUE INDEX uq_doctor_slot
    ON appointment (doctor_id, appt_date, appt_time) WHERE status = 'Scheduled';

CREATE TABLE hospital_bed (
    bed_id      SERIAL PRIMARY KEY,
    ward        VARCHAR(50) NOT NULL,
    bed_number  VARCHAR(10) NOT NULL,
    bed_type    VARCHAR(10) NOT NULL CHECK (bed_type IN ('General','ICU','Emergency','Private')),
    status      VARCHAR(12) NOT NULL DEFAULT 'Available'
                CHECK (status IN ('Available','Occupied','Maintenance')),
    daily_rate  NUMERIC(10,2) NOT NULL CHECK (daily_rate >= 0),
    UNIQUE (ward, bed_number)
);

CREATE TABLE admission (
    adm_id          SERIAL PRIMARY KEY,
    patient_id      INT NOT NULL REFERENCES patient(patient_id),
    bed_id          INT NOT NULL REFERENCES hospital_bed(bed_id),
    admit_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
    discharge_time  TIMESTAMPTZ,
    is_emergency    BOOLEAN NOT NULL DEFAULT FALSE,
    reason          TEXT,
    CHECK (discharge_time IS NULL OR discharge_time >= admit_time)
);
CREATE UNIQUE INDEX uq_active_admission_bed     ON admission (bed_id)     WHERE discharge_time IS NULL;
CREATE UNIQUE INDEX uq_active_admission_patient ON admission (patient_id) WHERE discharge_time IS NULL;

CREATE TABLE medical_record (
    record_id   SERIAL PRIMARY KEY,
    patient_id  INT NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    doctor_id   INT NOT NULL REFERENCES doctor(doctor_id),
    appt_id     INT REFERENCES appointment(appt_id) ON DELETE SET NULL,
    visit_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    diagnosis   TEXT NOT NULL,
    treatment   TEXT,
    notes       TEXT
);

CREATE TABLE medicine (
    med_id         SERIAL PRIMARY KEY,
    name           VARCHAR(120) NOT NULL UNIQUE,
    unit_price     NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    stock_qty      INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),   -- never negative
    reorder_level  INT NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
    expiry_date    DATE NOT NULL
);

CREATE TABLE prescription (
    rx_id          SERIAL PRIMARY KEY,
    record_id      INT NOT NULL REFERENCES medical_record(record_id) ON DELETE CASCADE,
    med_id         INT NOT NULL REFERENCES medicine(med_id),
    quantity       INT NOT NULL CHECK (quantity > 0),
    dosage         VARCHAR(100),
    duration_days  INT CHECK (duration_days > 0)
);

CREATE TABLE bill (
    bill_id       SERIAL PRIMARY KEY,
    patient_id    INT NOT NULL REFERENCES patient(patient_id),
    adm_id        INT REFERENCES admission(adm_id),
    bill_date     TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    status        VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Partial','Paid'))
);

CREATE TABLE bill_item (
    item_id     SERIAL PRIMARY KEY,
    bill_id     INT NOT NULL REFERENCES bill(bill_id) ON DELETE CASCADE,
    description VARCHAR(200) NOT NULL,
    quantity    INT NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    line_total  NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE payment (
    pay_id    SERIAL PRIMARY KEY,
    bill_id   INT NOT NULL REFERENCES bill(bill_id),
    amount    NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    method    VARCHAR(10) NOT NULL CHECK (method IN ('Cash','Card','UPI','Insurance')),
    paid_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
    user_id        SERIAL PRIMARY KEY,
    username       VARCHAR(50) NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,                      -- bcrypt via pgcrypto crypt()
    role           VARCHAR(12) NOT NULL
                   CHECK (role IN ('admin','doctor','receptionist','pharmacist','patient')),
    doctor_id      INT REFERENCES doctor(doctor_id),
    patient_id     INT REFERENCES patient(patient_id),
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK ((role <> 'doctor'  OR doctor_id  IS NOT NULL)),
    CHECK ((role <> 'patient' OR patient_id IS NOT NULL))
);

CREATE TABLE audit_log (
    log_id      BIGSERIAL PRIMARY KEY,
    table_name  TEXT NOT NULL,
    operation   TEXT NOT NULL,
    row_id      TEXT,
    changed_by  TEXT NOT NULL DEFAULT current_user,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    old_data    JSONB,
    new_data    JSONB
);

-- ---------------------------------------------------------------------
-- 2. INDEXES (speed up the common lookups)
-- ---------------------------------------------------------------------
CREATE INDEX idx_patient_name        ON patient (lower(full_name));
CREATE INDEX idx_patient_phone       ON patient (phone);
CREATE INDEX idx_appt_patient        ON appointment (patient_id);
CREATE INDEX idx_appt_doctor_date    ON appointment (doctor_id, appt_date);
CREATE INDEX idx_record_patient      ON medical_record (patient_id, visit_date DESC);
CREATE INDEX idx_rx_record           ON prescription (record_id);
CREATE INDEX idx_medicine_expiry     ON medicine (expiry_date);
CREATE INDEX idx_bill_patient        ON bill (patient_id);
CREATE INDEX idx_payment_bill        ON payment (bill_id);
CREATE INDEX idx_bed_status          ON hospital_bed (status);
CREATE INDEX idx_audit_table_time    ON audit_log (table_name, changed_at DESC);

-- ---------------------------------------------------------------------
-- 3. TRIGGER FUNCTIONS
-- ---------------------------------------------------------------------

-- 3a. Generic audit trail (national_id_enc is stripped from the log)
CREATE OR REPLACE FUNCTION fn_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    pk  TEXT := TG_ARGV[0];
    who TEXT := COALESCE(current_setting('app.current_user', true), current_user);
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log(table_name, operation, row_id, changed_by, old_data)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD)->>pk, who, to_jsonb(OLD) - 'national_id_enc');
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log(table_name, operation, row_id, changed_by, old_data, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(NEW)->>pk, who,
                to_jsonb(OLD) - 'national_id_enc', to_jsonb(NEW) - 'national_id_enc');
        RETURN NEW;
    ELSE
        INSERT INTO audit_log(table_name, operation, row_id, changed_by, new_data)
        VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(NEW)->>pk, who, to_jsonb(NEW) - 'national_id_enc');
        RETURN NEW;
    END IF;
END $$;

CREATE TRIGGER trg_audit_patient  AFTER INSERT OR UPDATE OR DELETE ON patient
    FOR EACH ROW EXECUTE FUNCTION fn_audit('patient_id');
CREATE TRIGGER trg_audit_record   AFTER INSERT OR UPDATE OR DELETE ON medical_record
    FOR EACH ROW EXECUTE FUNCTION fn_audit('record_id');
CREATE TRIGGER trg_audit_medicine AFTER UPDATE OR DELETE ON medicine
    FOR EACH ROW EXECUTE FUNCTION fn_audit('med_id');
CREATE TRIGGER trg_audit_bill     AFTER INSERT OR UPDATE OR DELETE ON bill
    FOR EACH ROW EXECUTE FUNCTION fn_audit('bill_id');
CREATE TRIGGER trg_audit_payment  AFTER INSERT ON payment
    FOR EACH ROW EXECUTE FUNCTION fn_audit('pay_id');

-- 3b. Appointment validation (working hours, no past slots, active doctor)
CREATE OR REPLACE FUNCTION fn_appt_validate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE is_active BOOLEAN;
BEGIN
    SELECT active INTO is_active FROM doctor WHERE doctor_id = NEW.doctor_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Doctor % does not exist', NEW.doctor_id; END IF;
    IF NOT is_active THEN RAISE EXCEPTION 'Doctor % is not accepting appointments', NEW.doctor_id; END IF;
    IF NEW.appt_time < TIME '09:00' OR NEW.appt_time > TIME '17:00' THEN
        RAISE EXCEPTION 'Appointments are only available between 09:00 and 17:00';
    END IF;
    IF (NEW.appt_date + NEW.appt_time) < now() THEN
        RAISE EXCEPTION 'Cannot book an appointment in the past';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_appt_validate BEFORE INSERT ON appointment
    FOR EACH ROW EXECUTE FUNCTION fn_appt_validate();

-- 3c. Prescription -> atomically deduct stock.
--     The UPDATE takes a row lock, so two pharmacists/doctors can never oversell.
CREATE OR REPLACE FUNCTION fn_prescription_stock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE medicine
       SET stock_qty = stock_qty - NEW.quantity
     WHERE med_id = NEW.med_id
       AND expiry_date > CURRENT_DATE
       AND stock_qty >= NEW.quantity;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Medicine % is out of stock, insufficient, or expired', NEW.med_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_prescription_stock BEFORE INSERT ON prescription
    FOR EACH ROW EXECUTE FUNCTION fn_prescription_stock();

-- 3d. Bed allocation: lock the bed row, verify availability, then flip status
CREATE OR REPLACE FUNCTION fn_admission_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st TEXT;
BEGIN
    SELECT status INTO st FROM hospital_bed WHERE bed_id = NEW.bed_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bed % does not exist', NEW.bed_id; END IF;
    IF st <> 'Available' THEN
        RAISE EXCEPTION 'Bed % is not available (status: %)', NEW.bed_id, st;
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fn_admission_after() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE hospital_bed SET status = 'Occupied' WHERE bed_id = NEW.bed_id;
    ELSIF OLD.discharge_time IS NULL AND NEW.discharge_time IS NOT NULL THEN
        UPDATE hospital_bed SET status = 'Available' WHERE bed_id = NEW.bed_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_admission_before BEFORE INSERT ON admission
    FOR EACH ROW EXECUTE FUNCTION fn_admission_before();
CREATE TRIGGER trg_admission_after  AFTER INSERT OR UPDATE ON admission
    FOR EACH ROW EXECUTE FUNCTION fn_admission_after();

-- 3e. Billing: keep total + status always consistent
CREATE OR REPLACE FUNCTION fn_refresh_bill(p_bill INT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE tot NUMERIC; paid NUMERIC;
BEGIN
    SELECT COALESCE(SUM(line_total), 0) INTO tot  FROM bill_item WHERE bill_id = p_bill;
    SELECT COALESCE(SUM(amount), 0)     INTO paid FROM payment   WHERE bill_id = p_bill;
    UPDATE bill
       SET total_amount = tot,
           status = CASE WHEN tot > 0 AND paid >= tot THEN 'Paid'
                         WHEN paid > 0 THEN 'Partial'
                         ELSE 'Pending' END
     WHERE bill_id = p_bill;
END $$;

CREATE OR REPLACE FUNCTION fn_bill_item_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b INT;
BEGIN
    IF TG_OP = 'DELETE' THEN b := OLD.bill_id; ELSE b := NEW.bill_id; END IF;
    PERFORM fn_refresh_bill(b);
    RETURN NULL;
END $$;

CREATE TRIGGER trg_bill_item_changed AFTER INSERT OR UPDATE OR DELETE ON bill_item
    FOR EACH ROW EXECUTE FUNCTION fn_bill_item_changed();

CREATE OR REPLACE FUNCTION fn_payment_before() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bal NUMERIC;
BEGIN
    -- Row lock on the bill serialises concurrent payments for the same bill
    SELECT total_amount - COALESCE((SELECT SUM(amount) FROM payment WHERE bill_id = NEW.bill_id), 0)
      INTO bal FROM bill WHERE bill_id = NEW.bill_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bill % does not exist', NEW.bill_id; END IF;
    IF NEW.amount > bal THEN
        RAISE EXCEPTION 'Payment % exceeds outstanding balance %', NEW.amount, bal;
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fn_payment_after() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM fn_refresh_bill(NEW.bill_id);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_payment_before BEFORE INSERT ON payment
    FOR EACH ROW EXECUTE FUNCTION fn_payment_before();
CREATE TRIGGER trg_payment_after  AFTER INSERT ON payment
    FOR EACH ROW EXECUTE FUNCTION fn_payment_after();

-- ---------------------------------------------------------------------
-- 4. STORED FUNCTIONS / PROCEDURES (business logic inside the DB)
-- ---------------------------------------------------------------------

-- Book an appointment; the partial unique index guarantees no double booking
CREATE OR REPLACE FUNCTION book_appointment(
    p_patient INT, p_doctor INT, p_date DATE, p_time TIME, p_reason TEXT DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE new_id INT;
BEGIN
    INSERT INTO appointment(patient_id, doctor_id, appt_date, appt_time, reason)
    VALUES (p_patient, p_doctor, p_date, p_time, p_reason)
    RETURNING appt_id INTO new_id;
    RETURN new_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'This time slot is already booked for the selected doctor';
END $$;

-- Admit (also used for emergency admissions: auto-picks an Emergency bed)
CREATE OR REPLACE FUNCTION admit_patient(
    p_patient INT, p_bed INT, p_reason TEXT DEFAULT NULL, p_emergency BOOLEAN DEFAULT FALSE
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE bed INT := p_bed; new_id INT;
BEGIN
    IF p_emergency AND bed IS NULL THEN
        SELECT bed_id INTO bed FROM hospital_bed
         WHERE status = 'Available' AND bed_type IN ('Emergency','ICU')
         ORDER BY (bed_type = 'Emergency') DESC, bed_id
         LIMIT 1 FOR UPDATE SKIP LOCKED;           -- concurrent emergencies get different beds
        IF bed IS NULL THEN RAISE EXCEPTION 'No emergency/ICU bed currently available'; END IF;
    END IF;
    IF bed IS NULL THEN RAISE EXCEPTION 'A bed must be selected'; END IF;

    INSERT INTO admission(patient_id, bed_id, reason, is_emergency)
    VALUES (p_patient, bed, p_reason, p_emergency)
    RETURNING adm_id INTO new_id;
    RETURN new_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Patient is already admitted or bed is already taken';
END $$;

-- Discharge + auto-generate bed-charge bill, all in one atomic call
CREATE OR REPLACE FUNCTION discharge_patient(p_adm INT) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE a admission%ROWTYPE; rate NUMERIC; days INT; v_bill INT;
BEGIN
    SELECT * INTO a FROM admission WHERE adm_id = p_adm FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Admission % not found', p_adm; END IF;
    IF a.discharge_time IS NOT NULL THEN RAISE EXCEPTION 'Patient already discharged'; END IF;

    UPDATE admission SET discharge_time = now() WHERE adm_id = p_adm;

    SELECT daily_rate INTO rate FROM hospital_bed WHERE bed_id = a.bed_id;
    days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (now() - a.admit_time)) / 86400.0)::INT);

    INSERT INTO bill(patient_id, adm_id) VALUES (a.patient_id, p_adm) RETURNING bill_id INTO v_bill;
    INSERT INTO bill_item(bill_id, description, quantity, unit_price)
    VALUES (v_bill, 'Bed charges (' || days || ' day(s))', days, rate);
    RETURN v_bill;
END $$;

-- Consultation bill from an appointment
CREATE OR REPLACE FUNCTION generate_consultation_bill(p_appt INT) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE a appointment%ROWTYPE; fee NUMERIC; dname TEXT; v_bill INT;
BEGIN
    SELECT * INTO a FROM appointment WHERE appt_id = p_appt;
    IF NOT FOUND THEN RAISE EXCEPTION 'Appointment % not found', p_appt; END IF;
    IF a.status = 'Cancelled' THEN RAISE EXCEPTION 'Cannot bill a cancelled appointment'; END IF;
    SELECT consultation_fee, full_name INTO fee, dname FROM doctor WHERE doctor_id = a.doctor_id;

    INSERT INTO bill(patient_id) VALUES (a.patient_id) RETURNING bill_id INTO v_bill;
    INSERT INTO bill_item(bill_id, description, quantity, unit_price)
    VALUES (v_bill, 'Consultation - ' || dname, 1, fee);
    RETURN v_bill;
END $$;

-- Add the cost of a record's prescriptions to a bill
CREATE OR REPLACE FUNCTION add_prescription_charges(p_bill INT, p_record INT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
    INSERT INTO bill_item(bill_id, description, quantity, unit_price)
    SELECT p_bill, 'Medicine - ' || m.name, rx.quantity, m.unit_price
      FROM prescription rx JOIN medicine m ON m.med_id = rx.med_id
     WHERE rx.record_id = p_record;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END $$;

-- User creation with bcrypt password hashing
CREATE OR REPLACE FUNCTION register_user(
    p_username TEXT, p_password TEXT, p_role TEXT, p_doctor INT DEFAULT NULL, p_patient INT DEFAULT NULL
) RETURNS INT LANGUAGE sql AS $$
    INSERT INTO app_user(username, password_hash, role, doctor_id, patient_id)
    VALUES (p_username, crypt(p_password, gen_salt('bf')), p_role, p_doctor, p_patient)
    RETURNING user_id;
$$;

-- ---------------------------------------------------------------------
-- 5. VIEWS
-- ---------------------------------------------------------------------
CREATE VIEW v_doctor_schedule AS
SELECT a.appt_id, a.appt_date, a.appt_time, a.status, a.reason,
       d.doctor_id, d.full_name AS doctor_name, dep.name AS department,
       p.patient_id, p.full_name AS patient_name, p.phone AS patient_phone
  FROM appointment a
  JOIN doctor d      ON d.doctor_id = a.doctor_id
  JOIN department dep ON dep.dept_id = d.dept_id
  JOIN patient p     ON p.patient_id = a.patient_id;

CREATE VIEW v_stock_alerts AS
SELECT med_id, name, stock_qty, reorder_level, expiry_date,
       CASE WHEN expiry_date <= CURRENT_DATE      THEN 'Expired'
            WHEN expiry_date <= CURRENT_DATE + 30 THEN 'Expiring soon'
            ELSE 'Low stock' END AS alert
  FROM medicine
 WHERE stock_qty <= reorder_level OR expiry_date <= CURRENT_DATE + 30;

CREATE VIEW v_bed_availability AS
SELECT ward, bed_type,
       COUNT(*)                                        AS total_beds,
       COUNT(*) FILTER (WHERE status = 'Available')    AS available,
       COUNT(*) FILTER (WHERE status = 'Occupied')     AS occupied
  FROM hospital_bed
 GROUP BY ward, bed_type;

CREATE VIEW v_patient_history AS
SELECT mr.patient_id, mr.record_id, mr.visit_date, d.full_name AS doctor_name,
       mr.diagnosis, mr.treatment, mr.notes,
       COALESCE(jsonb_agg(jsonb_build_object(
                'medicine', m.name, 'quantity', rx.quantity,
                'dosage', rx.dosage, 'days', rx.duration_days))
                FILTER (WHERE rx.rx_id IS NOT NULL), '[]'::jsonb) AS prescriptions
  FROM medical_record mr
  JOIN doctor d           ON d.doctor_id = mr.doctor_id
  LEFT JOIN prescription rx ON rx.record_id = mr.record_id
  LEFT JOIN medicine m      ON m.med_id = rx.med_id
 GROUP BY mr.record_id, d.full_name;

CREATE VIEW v_bill_summary AS
SELECT b.bill_id, b.patient_id, p.full_name AS patient_name, b.bill_date,
       b.total_amount, b.status,
       COALESCE(SUM(pay.amount), 0)                       AS paid,
       b.total_amount - COALESCE(SUM(pay.amount), 0)      AS balance
  FROM bill b
  JOIN patient p ON p.patient_id = b.patient_id
  LEFT JOIN payment pay ON pay.bill_id = b.bill_id
 GROUP BY b.bill_id, p.full_name;

CREATE VIEW v_revenue_daily AS
SELECT paid_at::date AS day, SUM(amount) AS revenue, COUNT(*) AS payments
  FROM payment GROUP BY paid_at::date;

-- Dashboard numbers in one round trip
CREATE OR REPLACE FUNCTION fn_dashboard_summary() RETURNS JSONB LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object(
  'patients',            (SELECT COUNT(*) FROM patient),
  'appointments_today',  (SELECT COUNT(*) FROM appointment WHERE appt_date = CURRENT_DATE AND status = 'Scheduled'),
  'beds_total',          (SELECT COUNT(*) FROM hospital_bed),
  'beds_available',      (SELECT COUNT(*) FROM hospital_bed WHERE status = 'Available'),
  'active_admissions',   (SELECT COUNT(*) FROM admission WHERE discharge_time IS NULL),
  'low_stock_alerts',    (SELECT COUNT(*) FROM v_stock_alerts),
  'revenue_today',       (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE paid_at::date = CURRENT_DATE),
  'revenue_month',       (SELECT COALESCE(SUM(amount), 0) FROM payment
                           WHERE date_trunc('month', paid_at) = date_trunc('month', now())),
  'outstanding_balance', (SELECT COALESCE(SUM(balance), 0) FROM v_bill_summary)
);
$$;

-- ---------------------------------------------------------------------
-- 6. SECURITY: database roles (RBAC) + Row-Level Security example
-- ---------------------------------------------------------------------
DO $$
DECLARE r TEXT;
BEGIN
    FOREACH r IN ARRAY ARRAY['hms_admin','hms_doctor','hms_receptionist','hms_pharmacist','hms_patient'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;
END $$;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO hms_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO hms_admin;

GRANT SELECT ON patient, doctor, department, appointment, medicine, hospital_bed,
                medical_record, prescription, v_patient_history, v_doctor_schedule TO hms_doctor;
GRANT INSERT ON medical_record, prescription TO hms_doctor;
GRANT UPDATE (status) ON appointment TO hms_doctor;

GRANT SELECT, INSERT, UPDATE ON patient, appointment, admission TO hms_receptionist;
GRANT SELECT, INSERT ON bill, bill_item, payment TO hms_receptionist;
GRANT SELECT ON doctor, department, hospital_bed, v_bed_availability, v_bill_summary TO hms_receptionist;

GRANT SELECT, INSERT, UPDATE ON medicine TO hms_pharmacist;
GRANT SELECT ON prescription, v_stock_alerts TO hms_pharmacist;

GRANT SELECT ON appointment, bill, v_bill_summary, v_patient_history TO hms_patient;
GRANT SELECT ON doctor, department TO hms_patient;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO hms_doctor, hms_receptionist, hms_pharmacist;

-- Row-Level Security: a patient-role session only sees its own rows.
-- (The API connects as the table owner, which bypasses RLS; enforcement for the
--  hms_patient role is shown for the demo:  SET ROLE hms_patient; SET app.patient_id = '1';)
ALTER TABLE appointment ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill        ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_patient_own_appt ON appointment FOR SELECT TO hms_patient
    USING (patient_id = NULLIF(current_setting('app.patient_id', true), '')::INT);
CREATE POLICY p_patient_own_bill ON bill FOR SELECT TO hms_patient
    USING (patient_id = NULLIF(current_setting('app.patient_id', true), '')::INT);
CREATE POLICY p_staff_all_appt ON appointment FOR ALL TO hms_admin, hms_doctor, hms_receptionist USING (true) WITH CHECK (true);
CREATE POLICY p_staff_all_bill ON bill        FOR ALL TO hms_admin, hms_receptionist USING (true) WITH CHECK (true);
