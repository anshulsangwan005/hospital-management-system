-- Sample data. Default logins (CHANGE THESE before any real use):
--   admin / admin123        doctor1 / doctor123     reception / reception123
--   pharma / pharma123      patient1 / patient123

INSERT INTO department(name, location) VALUES
 ('Cardiology','Block A, Floor 2'), ('Orthopedics','Block B, Floor 1'),
 ('Pediatrics','Block A, Floor 1'), ('General Medicine','Block C, Floor 1'),
 ('Emergency','Ground Floor');

INSERT INTO doctor(full_name, specialization, phone, email, dept_id, consultation_fee) VALUES
 ('Dr. Ananya Sharma','Cardiologist','9810000001','ananya@hms.local',1,800),
 ('Dr. Rohit Verma','Orthopedic Surgeon','9810000002','rohit@hms.local',2,700),
 ('Dr. Meera Iyer','Pediatrician','9810000003','meera@hms.local',3,500),
 ('Dr. Sandeep Rao','General Physician','9810000004','sandeep@hms.local',4,400),
 ('Dr. Kavita Nair','Emergency Medicine','9810000005','kavita@hms.local',5,600);

INSERT INTO patient(full_name, dob, gender, phone, email, address, blood_group, national_id_enc) VALUES
 ('Rahul Mehta','1990-04-12','M','9900000001','rahul@mail.com','Ghaziabad, UP','B+',
    pgp_sym_encrypt('1234-5678-9012','change-this-encryption-key')),
 ('Priya Singh','1985-09-30','F','9900000002','priya@mail.com','Noida, UP','O+',
    pgp_sym_encrypt('2345-6789-0123','change-this-encryption-key')),
 ('Aarav Gupta','2018-01-15','M','9900000003',NULL,'Delhi','A+',NULL),
 ('Sunita Devi','1962-07-21','F','9900000004',NULL,'Meerut, UP','AB+',NULL),
 ('Imran Khan','1978-12-02','M','9900000005','imran@mail.com','Greater Noida, UP','O-',NULL);

INSERT INTO hospital_bed(ward, bed_number, bed_type, daily_rate) VALUES
 ('General Ward','G-01','General',1000), ('General Ward','G-02','General',1000),
 ('General Ward','G-03','General',1000), ('Private Wing','P-01','Private',3500),
 ('Private Wing','P-02','Private',3500), ('ICU','ICU-01','ICU',8000),
 ('ICU','ICU-02','ICU',8000), ('Emergency','ER-01','Emergency',2500),
 ('Emergency','ER-02','Emergency',2500);

INSERT INTO medicine(name, unit_price, stock_qty, reorder_level, expiry_date) VALUES
 ('Paracetamol 500mg', 2.50, 500, 100, CURRENT_DATE + 400),
 ('Amoxicillin 250mg', 8.00, 200, 50,  CURRENT_DATE + 300),
 ('Atorvastatin 10mg', 12.00, 150, 40, CURRENT_DATE + 500),
 ('Ibuprofen 400mg', 3.50, 8,  20, CURRENT_DATE + 250),   -- low stock alert
 ('Cetirizine 10mg', 2.00, 300, 50, CURRENT_DATE + 15);   -- expiring soon alert

SELECT register_user('admin',     'admin123',     'admin');
SELECT register_user('doctor1',   'doctor123',    'doctor', 1, NULL);
SELECT register_user('reception', 'reception123', 'receptionist');
SELECT register_user('pharma',    'pharma123',    'pharmacist');
SELECT register_user('patient1',  'patient123',   'patient', NULL, 1);

SELECT book_appointment(1, 1, CURRENT_DATE + 1, '10:00', 'Chest pain follow-up');
SELECT book_appointment(2, 4, CURRENT_DATE + 1, '11:30', 'Fever and cough');
SELECT book_appointment(3, 3, CURRENT_DATE + 2, '09:30', 'Routine checkup');
