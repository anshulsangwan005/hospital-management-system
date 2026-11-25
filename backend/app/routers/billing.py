from fastapi import APIRouter, Depends, HTTPException

from ..auth import current_user, require_roles
from ..db import query
from ..schemas import BillItemIn, PaymentIn

router = APIRouter(tags=["billing"])
BILLING_STAFF = ("admin", "receptionist")


def _load_bill(bill_id: int, user: dict) -> dict:
    bill = query("SELECT * FROM v_bill_summary WHERE bill_id = %s", (bill_id,), one=True)
    if not bill:
        raise HTTPException(404, "Bill not found")
    if user["role"] == "patient" and bill["patient_id"] != user["patient_id"]:
        raise HTTPException(403, "You cannot view this bill")
    if user["role"] not in (*BILLING_STAFF, "patient"):
        raise HTTPException(403, "You do not have permission to view bills")
    return bill


@router.get("/bills")
def list_bills(user: dict = Depends(current_user)):
    if user["role"] == "patient":
        return query(
            "SELECT * FROM v_bill_summary WHERE patient_id = %s ORDER BY bill_id DESC", (user["patient_id"],)
        )
    if user["role"] not in BILLING_STAFF:
        raise HTTPException(403, "You do not have permission to view bills")
    return query("SELECT * FROM v_bill_summary ORDER BY bill_id DESC LIMIT 200")


@router.get("/bills/{bill_id}")
def bill_detail(bill_id: int, user: dict = Depends(current_user)):
    bill = _load_bill(bill_id, user)
    bill["items"] = query(
        "SELECT item_id, description, quantity, unit_price, line_total FROM bill_item WHERE bill_id=%s ORDER BY item_id",
        (bill_id,),
    )
    bill["payments"] = query(
        "SELECT pay_id, amount, method, paid_at FROM payment WHERE bill_id=%s ORDER BY pay_id", (bill_id,)
    )
    return bill


@router.post("/bills/consultation/{appt_id}", status_code=201)
def consultation_bill(appt_id: int, user: dict = Depends(require_roles(*BILLING_STAFF))):
    return query("SELECT generate_consultation_bill(%s) AS bill_id", (appt_id,), one=True)


@router.post("/bills/{bill_id}/items", status_code=201)
def add_item(bill_id: int, item: BillItemIn, user: dict = Depends(require_roles(*BILLING_STAFF))):
    return query(
        """INSERT INTO bill_item(bill_id, description, quantity, unit_price)
           VALUES (%s,%s,%s,%s) RETURNING item_id""",
        (bill_id, item.description, item.quantity, item.unit_price),
        one=True,
    )


@router.post("/bills/{bill_id}/prescriptions/{record_id}", status_code=201)
def add_rx_charges(bill_id: int, record_id: int, user: dict = Depends(require_roles(*BILLING_STAFF))):
    return query("SELECT add_prescription_charges(%s,%s) AS items_added", (bill_id, record_id), one=True)


@router.post("/bills/{bill_id}/payments", status_code=201)
def pay(bill_id: int, body: PaymentIn, user: dict = Depends(require_roles(*BILLING_STAFF))):
    # Trigger locks the bill row and rejects over-payment; status updates automatically.
    return query(
        "INSERT INTO payment(bill_id, amount, method) VALUES (%s,%s,%s) RETURNING pay_id",
        (bill_id, body.amount, body.method),
        one=True,
    )
