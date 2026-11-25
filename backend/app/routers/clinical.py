from fastapi import APIRouter, Depends, HTTPException

from ..auth import require_roles
from ..db import query, transaction
from ..schemas import MedicineIn, RecordIn, RestockIn

router = APIRouter(tags=["clinical"])


@router.post("/records", status_code=201)
def create_record(body: RecordIn, user: dict = Depends(require_roles("doctor", "admin"))):
    """Medical record + prescriptions in ONE transaction.
    If any medicine is out of stock/expired, the trigger raises and everything rolls back."""
    doctor_id = user["doctor_id"] if user["role"] == "doctor" else body.doctor_id
    if not doctor_id:
        raise HTTPException(400, "doctor_id is required")
    with transaction() as cur:
        cur.execute(
            """INSERT INTO medical_record(patient_id, doctor_id, appt_id, diagnosis, treatment, notes)
               VALUES (%s,%s,%s,%s,%s,%s) RETURNING record_id""",
            (body.patient_id, doctor_id, body.appt_id, body.diagnosis, body.treatment, body.notes),
        )
        record_id = cur.fetchone()["record_id"]
        for rx in body.prescriptions:
            cur.execute(
                """INSERT INTO prescription(record_id, med_id, quantity, dosage, duration_days)
                   VALUES (%s,%s,%s,%s,%s)""",
                (record_id, rx.med_id, rx.quantity, rx.dosage, rx.duration_days),
            )
        if body.appt_id:
            cur.execute("UPDATE appointment SET status = 'Completed' WHERE appt_id = %s", (body.appt_id,))
    return {"record_id": record_id}


# ---------------- Pharmacy / inventory ----------------
@router.get("/medicines")
def medicines(user: dict = Depends(require_roles("admin", "doctor", "pharmacist"))):
    return query(
        """SELECT med_id, name, unit_price, stock_qty, reorder_level, expiry_date
             FROM medicine ORDER BY name"""
    )


@router.get("/medicines/alerts")
def medicine_alerts(user: dict = Depends(require_roles("admin", "pharmacist"))):
    return query("SELECT * FROM v_stock_alerts ORDER BY alert, name")


@router.post("/medicines", status_code=201)
def add_medicine(m: MedicineIn, user: dict = Depends(require_roles("admin", "pharmacist"))):
    return query(
        """INSERT INTO medicine(name, unit_price, stock_qty, reorder_level, expiry_date)
           VALUES (%s,%s,%s,%s,%s) RETURNING med_id""",
        (m.name, m.unit_price, m.stock_qty, m.reorder_level, m.expiry_date),
        one=True,
    )


@router.patch("/medicines/{med_id}/restock")
def restock(med_id: int, body: RestockIn, user: dict = Depends(require_roles("admin", "pharmacist"))):
    row = query(
        "UPDATE medicine SET stock_qty = stock_qty + %s WHERE med_id = %s RETURNING med_id, stock_qty",
        (body.quantity, med_id),
        one=True,
    )
    if not row:
        raise HTTPException(404, "Medicine not found")
    return row
