import { useEffect, useState } from "react";
import { api, getUser } from "../api";
import { ErrorMsg, Field, OkMsg, PageTitle } from "../components/Layout.jsx";

const STATUS_STYLE = {
  Scheduled: "bg-sky-100 text-sky-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-slate-200 text-slate-600",
  "No-Show": "bg-amber-100 text-amber-800",
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Appointments() {
  const user = getUser();
  const isPatient = user.role === "patient";
  const canBook = ["admin", "receptionist", "patient"].includes(user.role);

  const [rows, setRows] = useState([]);
  const [day, setDay] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [booked, setBooked] = useState([]);
  const [form, setForm] = useState({ patient_id: "", doctor_id: "", appt_date: today(), appt_time: "10:00", reason: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = () => api.get(`/appointments${day ? `?day=${day}` : ""}`).then(setRows).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    if (canBook) api.get("/doctors").then(setDoctors).catch(() => {});
    if (canBook && !isPatient) api.get("/patients?limit=200").then(setPatients).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [day]);

  // Real-time availability of the chosen doctor/day
  useEffect(() => {
    if (form.doctor_id && form.appt_date) {
      api.get(`/doctors/${form.doctor_id}/booked?day=${form.appt_date}`).then(setBooked).catch(() => setBooked([]));
    } else setBooked([]);
  }, [form.doctor_id, form.appt_date, ok]);

  async function book(e) {
    e.preventDefault();
    setError(""); setOk("");
    try {
      await api.post("/appointments", {
        patient_id: isPatient ? null : Number(form.patient_id),
        doctor_id: Number(form.doctor_id),
        appt_date: form.appt_date,
        appt_time: form.appt_time,
        reason: form.reason || null,
      });
      setOk("Appointment booked"); load();
    } catch (err) { setError(err.message); }
  }

  async function setStatus(id, status) {
    setError(""); setOk("");
    try { await api.patch(`/appointments/${id}/status`, { status }); load(); } catch (err) { setError(err.message); }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageTitle sub="Double bookings are blocked by the database itself">Appointments</PageTitle>
      <ErrorMsg error={error} />
      <OkMsg msg={ok} />

      {canBook && (
        <form onSubmit={book} className="card mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
          {!isPatient && (
            <Field label="Patient *">
              <select className="input" required value={form.patient_id} onChange={set("patient_id")}>
                <option value="">Select</option>
                {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.full_name} (#{p.patient_id})</option>)}
              </select>
            </Field>
          )}
          <Field label="Doctor *">
            <select className="input" required value={form.doctor_id} onChange={set("doctor_id")}>
              <option value="">Select</option>
              {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>{d.full_name} - {d.department}</option>)}
            </select>
          </Field>
          <Field label="Date *"><input className="input" type="date" min={today()} required value={form.appt_date} onChange={set("appt_date")} /></Field>
          <Field label="Time * (09:00-17:00)"><input className="input" type="time" min="09:00" max="17:00" step="900" required value={form.appt_time} onChange={set("appt_time")} /></Field>
          <Field label="Reason"><input className="input" value={form.reason} onChange={set("reason")} /></Field>
          <div className="md:col-span-5 flex items-center gap-4">
            <button className="btn">Book appointment</button>
            {form.doctor_id && (
              <span className="text-xs text-slate-500">
                Already booked that day: {booked.length ? booked.join(", ") : "none - fully available"}
              </span>
            )}
          </div>
        </form>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-600">Filter by date:</span>
        <input className="input max-w-[11rem]" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        {day && <button className="btn-secondary" onClick={() => setDay("")}>Clear</button>}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr>{["Date", "Time", "Patient", "Doctor", "Department", "Reason", "Status", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.appt_id}>
                <td className="td">{a.appt_date}</td><td className="td">{String(a.appt_time).slice(0, 5)}</td>
                <td className="td">{a.patient_name}</td><td className="td">{a.doctor_name}</td>
                <td className="td">{a.department}</td><td className="td">{a.reason}</td>
                <td className="td"><span className={`badge ${STATUS_STYLE[a.status]}`}>{a.status}</span></td>
                <td className="td whitespace-nowrap text-right">
                  {a.status === "Scheduled" && (
                    <>
                      {!isPatient && <button className="btn-secondary mr-1" onClick={() => setStatus(a.appt_id, "Completed")}>Complete</button>}
                      {!isPatient && user.role !== "doctor" && <button className="btn-secondary mr-1" onClick={() => setStatus(a.appt_id, "No-Show")}>No-show</button>}
                      <button className="btn-danger" onClick={() => setStatus(a.appt_id, "Cancelled")}>Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-slate-400" colSpan={8}>No appointments</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
