from fastapi import APIRouter, Depends

from ..auth import require_roles
from ..db import query
from ..schemas import AdmitIn

router = APIRouter(tags=["beds & admissions"])
STAFF = ("admin", "doctor", "receptionist")


@router.get("/beds")
def beds(user: dict = Depends(require_roles(*STAFF))):
    return query(
        "SELECT bed_id, ward, bed_number, bed_type, status, daily_rate FROM hospital_bed ORDER BY ward, bed_number"
    )


@router.get("/beds/availability")
def availability(user: dict = Depends(require_roles(*STAFF))):
    return query("SELECT * FROM v_bed_availability ORDER BY ward")


@router.get("/admissions/active")
def active_admissions(user: dict = Depends(require_roles(*STAFF))):
    return query(
        """SELECT a.adm_id, a.admit_time, a.is_emergency, a.reason,
                  p.patient_id, p.full_name AS patient_name,
                  b.bed_id, b.ward, b.bed_number, b.bed_type
             FROM admission a
             JOIN patient p ON p.patient_id = a.patient_id
             JOIN hospital_bed b ON b.bed_id = a.bed_id
            WHERE a.discharge_time IS NULL
            ORDER BY a.admit_time DESC"""
    )


@router.post("/admissions", status_code=201)
def admit(body: AdmitIn, user: dict = Depends(require_roles("admin", "receptionist", "doctor"))):
    # Emergency + no bed => the DB function picks a free Emergency/ICU bed (SKIP LOCKED)
    return query(
        "SELECT admit_patient(%s,%s,%s,%s) AS adm_id",
        (body.patient_id, body.bed_id, body.reason, body.is_emergency),
        one=True,
    )


@router.post("/admissions/{adm_id}/discharge")
def discharge(adm_id: int, user: dict = Depends(require_roles("admin", "receptionist", "doctor"))):
    return query("SELECT discharge_patient(%s) AS bill_id", (adm_id,), one=True)
