import { useEffect, useState } from "react";
import { api, getUser } from "../api";
import { ErrorMsg, Field, OkMsg, PageTitle } from "../components/Layout.jsx";

const EMPTY = { full_name: "", dob: "", gender: "M", phone: "", email: "", address: "", blood_group: "", national_id: "" };

export default function Patients() {
  const user = getUser();
  const canRegister = ["admin", "receptionist"].includes(user.role);
  const canWriteRecords = ["admin", "doctor"].includes(user.role);

  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = () => api.get(`/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setPatients).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function register(e) {
    e.preventDefault();
    setError(""); setOk("");
    try {
      const body = { ...form };
      Object.keys(body).forEach((k) => body[k] === "" && (body[k] = null));
      const r = await api.post("/patients", body);
      setOk(`Patient registered (ID ${r.patient_id})`);
      setForm(EMPTY); setShowForm(false); load();
    } catch (err) { setError(err.message); }
  }

  async function openHistory(p) {
    setSelected(p); setError("");
    try { setHistory(await api.get(`/patients/${p.patient_id}/history`)); } catch (err) { setError(err.message); }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageTitle sub="Registration, search and medical history">Patients</PageTitle>
      <ErrorMsg error={error} />
      <OkMsg msg={ok} />

      <div className="mb-4 flex gap-2">
        <input className="input max-w-xs" placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <button className="btn-secondary" onClick={load}>Search</button>
        {canRegister && <button className="btn" onClick={() => setShowForm(!showForm)}>{showForm ? "Close" : "+ Register patient"}</button>}
      </div>

      {showForm && (
        <form onSubmit={register} className="card mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field label="Full name *"><input className="input" required value={form.full_name} onChange={set("full_name")} /></Field>
          <Field label="Date of birth *"><input className="input" type="date" required value={form.dob} onChange={set("dob")} /></Field>
          <Field label="Gender *">
            <select className="input" value={form.gender} onChange={set("gender")}>
              <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
            </select>
          </Field>
          <Field label="Blood group">
            <select className="input" value={form.blood_group} onChange={set("blood_group")}>
              <option value="">-</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Phone"><input className="input" value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={set("email")} /></Field>
          <Field label="Address"><input className="input" value={form.address} onChange={set("address")} /></Field>
          <Field label="National ID (stored AES-encrypted)"><input className="input" value={form.national_id} onChange={set("national_id")} /></Field>
          <div className="md:col-span-4"><button className="btn">Save patient</button></div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr>{["ID", "Name", "DOB", "Gender", "Phone", "Blood", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.patient_id} className={selected?.patient_id === p.patient_id ? "bg-teal-50" : ""}>
                <td className="td">{p.patient_id}</td><td className="td font-medium">{p.full_name}</td>
                <td className="td">{p.dob}</td><td className="td">{p.gender}</td>
                <td className="td">{p.phone}</td><td className="td">{p.blood_group}</td>
                <td className="td text-right"><button className="btn-secondary" onClick={() => openHistory(p)}>History</button></td>
              </tr>
            ))}
            {patients.length === 0 && <tr><td className="td text-slate-400" colSpan={7}>No patients found</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <History patient={selected} history={history} canWrite={canWriteRecords} user={user}
          onSaved={() => { openHistory(selected); setOk("Medical record saved"); }} onError={setError} />
      )}
    </>
  );
}

function History({ patient, history, canWrite, user, onSaved, onError }) {
  const [meds, setMeds] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [rec, setRec] = useState({ diagnosis: "", treatment: "", notes: "", doctor_id: "", med_id: "", quantity: 1, dosage: "" });

  useEffect(() => {
    if (!canWrite) return;
    api.get("/medicines").then(setMeds).catch(() => {});
    if (user.role === "admin") api.get("/doctors").then(setDoctors).catch(() => {});
  }, [canWrite]);

  async function save(e) {
    e.preventDefault();
    try {
      await api.post("/records", {
        patient_id: patient.patient_id,
        doctor_id: rec.doctor_id ? Number(rec.doctor_id) : null,
        diagnosis: rec.diagnosis, treatment: rec.treatment || null, notes: rec.notes || null,
        prescriptions: rec.med_id ? [{ med_id: Number(rec.med_id), quantity: Number(rec.quantity), dosage: rec.dosage || null }] : [],
      });
      setRec({ ...rec, diagnosis: "", treatment: "", notes: "", med_id: "", quantity: 1, dosage: "" });
      onSaved();
    } catch (err) { onError(err.message); }
  }
  const set = (k) => (e) => setRec({ ...rec, [k]: e.target.value });

  return (
    <div className="card mt-6">
      <h2 className="mb-3 text-lg font-semibold">Medical history - {patient.full_name}</h2>

      {canWrite && (
        <form onSubmit={save} className="mb-5 grid grid-cols-1 gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-4">
          {user.role === "admin" && (
            <Field label="Doctor *">
              <select className="input" required value={rec.doctor_id} onChange={set("doctor_id")}>
                <option value="">Select</option>
                {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>{d.full_name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Diagnosis *"><input className="input" required value={rec.diagnosis} onChange={set("diagnosis")} /></Field>
          <Field label="Treatment"><input className="input" value={rec.treatment} onChange={set("treatment")} /></Field>
          <Field label="Notes"><input className="input" value={rec.notes} onChange={set("notes")} /></Field>
          <Field label="Prescribe medicine">
            <select className="input" value={rec.med_id} onChange={set("med_id")}>
              <option value="">None</option>
              {meds.map((m) => <option key={m.med_id} value={m.med_id}>{m.name} (stock {m.stock_qty})</option>)}
            </select>
          </Field>
          <Field label="Quantity"><input className="input" type="number" min="1" value={rec.quantity} onChange={set("quantity")} /></Field>
          <Field label="Dosage"><input className="input" placeholder="1 tablet twice daily" value={rec.dosage} onChange={set("dosage")} /></Field>
          <div className="flex items-end"><button className="btn">Add record</button></div>
        </form>
      )}

      {history.length === 0 && <p className="text-sm text-slate-400">No records yet.</p>}
      <div className="space-y-3">
        {history.map((h) => (
          <div key={h.record_id} className="rounded-md border border-slate-200 p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{h.diagnosis}</span>
              <span className="text-slate-500">{h.visit_date} - {h.doctor_name}</span>
            </div>
            {h.treatment && <div className="text-slate-600">Treatment: {h.treatment}</div>}
            {h.notes && <div className="text-slate-500">Notes: {h.notes}</div>}
            {h.prescriptions.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-slate-700">
                {h.prescriptions.map((r, i) => <li key={i}>{r.medicine} x{r.quantity}{r.dosage ? ` - ${r.dosage}` : ""}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
