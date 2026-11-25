from fastapi import APIRouter, Depends

from ..auth import require_roles
from ..db import query

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary(user: dict = Depends(require_roles("admin", "doctor", "receptionist", "pharmacist"))):
    return query("SELECT fn_dashboard_summary() AS s", one=True)["s"]


@router.get("/revenue")
def revenue(user: dict = Depends(require_roles("admin", "receptionist"))):
    rows = query(
        """SELECT day, revenue, payments FROM v_revenue_daily
            WHERE day >= CURRENT_DATE - 29 ORDER BY day"""
    )
    return rows


@router.get("/appointments-by-department")
def appointments_by_department(user: dict = Depends(require_roles("admin"))):
    return query(
        """SELECT dep.name AS department, COUNT(*) AS appointments
             FROM appointment a
             JOIN doctor d ON d.doctor_id = a.doctor_id
             JOIN department dep ON dep.dept_id = d.dept_id
            GROUP BY dep.name ORDER BY appointments DESC"""
    )


@router.get("/audit")
def audit(user: dict = Depends(require_roles("admin"))):
    return query(
        """SELECT log_id, table_name, operation, row_id, changed_by, changed_at
             FROM audit_log ORDER BY log_id DESC LIMIT 100"""
    )
