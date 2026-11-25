from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..auth import current_user, require_roles
from ..db import query
from ..schemas import AppointmentIn, StatusIn

router = APIRouter(tags=["appointments"])
STAFF = ("admin", "doctor", "receptionist")


@router.get("/departments")
def departments(user: dict = Depends(current_user)):
    return query("SELECT dept_id, name, location FROM department ORDER BY name")


@router.get("/doctors")
def doctors(user: dict = Depends(current_user)):
    return query(
        """SELECT d.doctor_id, d.full_name, d.specialization, d.consultation_fee,
                  dep.name AS department
             FROM doctor d JOIN department dep ON dep.dept_id = d.dept_id
            WHERE d.active ORDER BY d.full_name"""
    )


@router.get("/doctors/{doctor_id}/booked")
def booked_slots(doctor_id: int, day: date, user: dict = Depends(current_user)):
    """Real-time availability: which times are already taken on a day."""
    rows = query(
        """SELECT to_char(appt_time, 'HH24:MI') AS time FROM appointment
            WHERE doctor_id = %s AND appt_date = %s AND status = 'Scheduled' ORDER BY appt_time""",
        (doctor_id, day),
    )
    return [r["time"] for r in rows]


@router.get("/appointments")
def list_appointments(
    day: Optional[date] = None, doctor_id: Optional[int] = None, user: dict = Depends(current_user)
):
    where, params = [], []
    if user["role"] == "patient":
        where.append("patient_id = %s")
        params.append(user["patient_id"])
    elif user["role"] == "doctor":
        where.append("doctor_id = %s")
        params.append(user["doctor_id"])
    elif user["role"] not in STAFF:
        raise HTTPException(403, "You do not have permission to view appointments")
    if day:
        where.append("appt_date = %s")
        params.append(day)
    if doctor_id and user["role"] != "doctor":
        where.append("doctor_id = %s")
        params.append(doctor_id)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    return query(
        f"""SELECT * FROM v_doctor_schedule {clause}
            ORDER BY appt_date DESC, appt_time LIMIT 300""",
        params,
    )


@router.post("/appointments", status_code=201)
def book(body: AppointmentIn, user: dict = Depends(require_roles("admin", "receptionist", "patient"))):
    patient_id = user["patient_id"] if user["role"] == "patient" else body.patient_id
    if not patient_id:
        raise HTTPException(400, "patient_id is required")
    return query(
        "SELECT book_appointment(%s,%s,%s,%s,%s) AS appt_id",
        (patient_id, body.doctor_id, body.appt_date, body.appt_time, body.reason),
        one=True,
    )


@router.patch("/appointments/{appt_id}/status")
def set_status(appt_id: int, body: StatusIn, user: dict = Depends(current_user)):
    appt = query("SELECT patient_id, doctor_id FROM appointment WHERE appt_id = %s", (appt_id,), one=True)
    if not appt:
        raise HTTPException(404, "Appointment not found")
    role = user["role"]
    allowed = (
        role in ("admin", "receptionist")
        or (role == "doctor" and appt["doctor_id"] == user["doctor_id"])
        or (role == "patient" and appt["patient_id"] == user["patient_id"] and body.status == "Cancelled")
    )
    if not allowed:
        raise HTTPException(403, "You cannot change this appointment")
    return query(
        "UPDATE appointment SET status = %s WHERE appt_id = %s RETURNING appt_id, status",
        (body.status, appt_id),
        one=True,
    )
