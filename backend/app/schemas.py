from datetime import date, time
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str
    password: str


class PatientIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    dob: date
    gender: str = Field(pattern="^[MFO]$")
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    blood_group: Optional[str] = Field(default=None, pattern="^(A|B|AB|O)[+-]$")
    national_id: Optional[str] = None


class AppointmentIn(BaseModel):
    patient_id: Optional[int] = None  # ignored for patient-role users (forced to own id)
    doctor_id: int
    appt_date: date
    appt_time: time
    reason: Optional[str] = None


class StatusIn(BaseModel):
    status: str = Field(pattern="^(Scheduled|Completed|Cancelled|No-Show)$")


class PrescriptionIn(BaseModel):
    med_id: int
    quantity: int = Field(gt=0)
    dosage: Optional[str] = None
    duration_days: Optional[int] = Field(default=None, gt=0)


class RecordIn(BaseModel):
    patient_id: int
    doctor_id: Optional[int] = None  # required only when an admin creates the record
    appt_id: Optional[int] = None
    diagnosis: str = Field(min_length=2)
    treatment: Optional[str] = None
    notes: Optional[str] = None
    prescriptions: List[PrescriptionIn] = []


class MedicineIn(BaseModel):
    name: str = Field(min_length=2)
    unit_price: Decimal = Field(ge=0)
    stock_qty: int = Field(ge=0)
    reorder_level: int = Field(default=10, ge=0)
    expiry_date: date


class RestockIn(BaseModel):
    quantity: int = Field(gt=0)


class AdmitIn(BaseModel):
    patient_id: int
    bed_id: Optional[int] = None  # omit for emergency auto-allocation
    reason: Optional[str] = None
    is_emergency: bool = False


class BillItemIn(BaseModel):
    description: str = Field(min_length=2)
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class PaymentIn(BaseModel):
    amount: Decimal = Field(gt=0)
    method: str = Field(pattern="^(Cash|Card|UPI|Insurance)$")
