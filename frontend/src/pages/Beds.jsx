import { useEffect, useState } from "react";
import { api, getUser } from "../api";
import { ErrorMsg, Field, OkMsg, PageTitle } from "../components/Layout.jsx";

const BED_STYLE = {
  Available: "border-emerald-300 bg-emerald-50 text-emerald-800",
  Occupied: "border-rose-300 bg-rose-50 text-rose-800",
  Maintenance: "border-amber-300 bg-amber-50 text-amber-800",
};

export default function Beds() {
  const user = getUser();
  const [beds, setBeds] = useState([]);
  const [avail, setAvail] = useState([]);
  const [active, setActive] = useState([]);
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({ patient_id: "", bed_id: "", reason: "", is_emergency: false });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = () => {
    api.get("/beds").then(setBeds).catch((e) => setError(e.message));
    api.get("/beds/availability").then(setAvail).catch(() => {});
    api.get("/admissions/active").then(setActive).catch(() => {});
  };
  useEffect(() => {
    load();
    api.get("/patients?limit=200").then(setPatients).catch(() => {});
  }, []);

  async function admit(e) {
    e.preventDefault();
    setError(""); setOk("");
    try {
      const r = await api.post("/admissions", {
        patient_id: Number(form.patient_id),
        bed_id: form.is_emergency && !form.bed_id ? null : Number(form.bed_id),
        reason: form.reason || null,
        is_emergency: form.is_emergency,
      });
      setOk(`Patient admitted (admission #${r.adm_id})`);
      setForm({ patient_id: "", bed_id: "", reason: "", is_emergency: false });
      load();
    } catch (err) { setError(err.message); }
  }

  async function discharge(id) {
    setError(""); setOk("");
    try {
      const r = await api.post(`/admissions/${id}/discharge`);
      setOk(`Patient discharged. Bill #${r.bill_id} generated automatically.`);
      load();
    } catch (err) { setError(err.message); }
  }

  const free = beds.filter((b) => b.status === "Available");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageTitle sub="Bed status changes automatically through database triggers">Beds & Admissions</PageTitle>
      <ErrorMsg error={error} />
      <OkMsg msg={ok} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {avail.map((a) => (
          <div key={a.ward + a.bed_type} className="card">
            <div className="text-sm font-medium">{a.ward}</div>
            <div className="text-xs text-slate-500">{a.bed_type}</div>
            <div className="mt-1 text-xl font-semibold">{a.available}<span className="text-sm font-normal text-slate-400"> / {a.total_beds} free</span></div>
          </div>
        ))}
      </div>

      <form onSubmit={admit} className="card mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
        <Field label="Patient *">
          <select className="input" required value={form.patient_id} onChange={set("patient_id")}>
            <option value="">Select</option>
            {patients.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.full_name} (#{p.patient_id})</option>)}
          </select>
        </Field>
        <Field label={form.is_emergency ? "Bed (blank = auto-assign)" : "Bed *"}>
          <select className="input" required={!form.is_emergency} value={form.bed_id} onChange={set("bed_id")}>
            <option value="">{form.is_emergency ? "Auto-assign emergency/ICU bed" : "Select"}</option>
            {free.map((b) => <option key={b.bed_id} value={b.bed_id}>{b.ward} {b.bed_number} ({b.bed_type})</option>)}
          </select>
        </Field>
        <Field label="Reason"><input className="input" value={form.reason} onChange={set("reason")} /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={form.is_emergency} onChange={(e) => setForm({ ...form, is_emergency: e.target.checked })} />
          Emergency admission
        </label>
        <div className="flex items-end"><button className="btn">Admit patient</button></div>
      </form>

      <h2 className="mb-2 text-sm font-semibold">Currently admitted</h2>
      <div className="card mb-5 overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr>{["Patient", "Bed", "Admitted", "Type", "Reason", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {active.map((a) => (
              <tr key={a.adm_id}>
                <td className="td font-medium">{a.patient_name}</td>
                <td className="td">{a.ward} {a.bed_number}</td>
                <td className="td">{new Date(a.admit_time).toLocaleString()}</td>
                <td className="td">{a.is_emergency ? <span className="badge bg-rose-100 text-rose-800">Emergency</span> : "Regular"}</td>
                <td className="td">{a.reason}</td>
                <td className="td text-right"><button className="btn-secondary" onClick={() => discharge(a.adm_id)}>Discharge & bill</button></td>
              </tr>
            ))}
            {active.length === 0 && <tr><td className="td text-slate-400" colSpan={6}>No active admissions</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold">All beds</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {beds.map((b) => (
          <div key={b.bed_id} className={`rounded-md border p-3 text-sm ${BED_STYLE[b.status]}`}>
            <div className="font-semibold">{b.bed_number}</div>
            <div className="text-xs">{b.ward} - {b.bed_type}</div>
            <div className="mt-1 text-xs font-medium">{b.status}</div>
          </div>
        ))}
      </div>
    </>
  );
}
