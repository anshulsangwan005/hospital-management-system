from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..auth import current_user, require_roles
from ..db import ENC_KEY, query
from ..schemas import PatientIn

router = APIRouter(prefix="/patients", tags=["patients"])
STAFF = ("admin", "doctor", "receptionist")

COLUMNS = "patient_id, full_name, dob, gender, phone, email, address, blood_group, created_at"


def _ensure_access(user: dict, patient_id: int):
    """Staff can see any patient; a patient can only see themselves."""
    if user["role"] in STAFF:
        return
    if user["role"] == "patient" and user["patient_id"] == patient_id:
        return
    raise HTTPException(403, "You do not have permission to view this patient")


@router.get("")
def list_patients(q: Optional[str] = None, limit: int = 50, user: dict = Depends(require_roles(*STAFF))):
    limit = max(1, min(limit, 200))
    if q:
        like = f"%{q.lower()}%"
        return query(
            f"""SELECT {COLUMNS} FROM patient
                 WHERE lower(full_name) LIKE %s OR phone LIKE %s
                 ORDER BY patient_id DESC LIMIT %s""",
            (like, f"%{q}%", limit),
        )
    return query(f"SELECT {COLUMNS} FROM patient ORDER BY patient_id DESC LIMIT %s", (limit,))


@router.post("", status_code=201)
def create_patient(p: PatientIn, user: dict = Depends(require_roles("admin", "receptionist"))):
    # pgp_sym_encrypt is STRICT: a NULL national id stays NULL
    return query(
        """INSERT INTO patient(full_name, dob, gender, phone, email, address, blood_group, national_id_enc)
           VALUES (%s,%s,%s,%s,%s,%s,%s, pgp_sym_encrypt(%s::text, %s))
           RETURNING patient_id""",
        (p.full_name, p.dob, p.gender, p.phone, p.email, p.address, p.blood_group, p.national_id, ENC_KEY),
        one=True,
    )


@router.get("/{patient_id}")
def get_patient(patient_id: int, user: dict = Depends(current_user)):
    _ensure_access(user, patient_id)
    row = query(f"SELECT {COLUMNS} FROM patient WHERE patient_id = %s", (patient_id,), one=True)
    if not row:
        raise HTTPException(404, "Patient not found")
    return row


@router.put("/{patient_id}")
def update_patient(patient_id: int, p: PatientIn, user: dict = Depends(require_roles("admin", "receptionist"))):
    row = query(
        """UPDATE patient SET full_name=%s, dob=%s, gender=%s, phone=%s, email=%s, address=%s, blood_group=%s
            WHERE patient_id=%s RETURNING patient_id""",
        (p.full_name, p.dob, p.gender, p.phone, p.email, p.address, p.blood_group, patient_id),
        one=True,
    )
    if not row:
        raise HTTPException(404, "Patient not found")
    return row


@router.get("/{patient_id}/history")
def patient_history(patient_id: int, user: dict = Depends(current_user)):
    _ensure_access(user, patient_id)
    return query(
        "SELECT * FROM v_patient_history WHERE patient_id = %s ORDER BY visit_date DESC, record_id DESC",
        (patient_id,),
    )
