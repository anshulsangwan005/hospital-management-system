import { useEffect, useState } from "react";
import { api, money } from "../api";
import { ErrorMsg, Field, OkMsg, PageTitle } from "../components/Layout.jsx";

const ALERT_STYLE = {
  Expired: "bg-rose-100 text-rose-800",
  "Expiring soon": "bg-amber-100 text-amber-800",
  "Low stock": "bg-orange-100 text-orange-800",
};

export default function Inventory() {
  const [meds, setMeds] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState({ name: "", unit_price: "", stock_qty: "", reorder_level: 10, expiry_date: "" });
  const [restockQty, setRestockQty] = useState({});
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = () => {
    api.get("/medicines").then(setMeds).catch((e) => setError(e.message));
    api.get("/medicines/alerts").then(setAlerts).catch(() => {});
  };
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    setError(""); setOk("");
    try {
      await api.post("/medicines", {
        name: form.name, unit_price: form.unit_price, stock_qty: Number(form.stock_qty),
        reorder_level: Number(form.reorder_level), expiry_date: form.expiry_date,
      });
      setOk("Medicine added");
      setForm({ name: "", unit_price: "", stock_qty: "", reorder_level: 10, expiry_date: "" });
      load();
    } catch (err) { setError(err.message); }
  }

  async function restock(id) {
    setError(""); setOk("");
    try {
      await api.patch(`/medicines/${id}/restock`, { quantity: Number(restockQty[id]) });
      setRestockQty({ ...restockQty, [id]: "" });
      setOk("Stock updated");
      load();
    } catch (err) { setError(err.message); }
  }

  const alertFor = (id) => alerts.find((a) => a.med_id === id)?.alert;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageTitle sub="Stock is deducted automatically when a doctor prescribes">Pharmacy & Inventory</PageTitle>
      <ErrorMsg error={error} />
      <OkMsg msg={ok} />

      {alerts.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <b>{alerts.length} stock alert(s):</b>{" "}
          {alerts.map((a) => `${a.name} (${a.alert})`).join(", ")}
        </div>
      )}

      <form onSubmit={add} className="card mb-5 grid grid-cols-1 gap-3 md:grid-cols-6">
        <Field label="Name *"><input className="input" required value={form.name} onChange={set("name")} /></Field>
        <Field label="Unit price *"><input className="input" type="number" step="0.01" min="0" required value={form.unit_price} onChange={set("unit_price")} /></Field>
        <Field label="Stock *"><input className="input" type="number" min="0" required value={form.stock_qty} onChange={set("stock_qty")} /></Field>
        <Field label="Reorder level"><input className="input" type="number" min="0" value={form.reorder_level} onChange={set("reorder_level")} /></Field>
        <Field label="Expiry *"><input className="input" type="date" required value={form.expiry_date} onChange={set("expiry_date")} /></Field>
        <div className="flex items-end"><button className="btn">Add medicine</button></div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead><tr>{["Medicine", "Price", "Stock", "Reorder at", "Expiry", "Alert", "Restock"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {meds.map((m) => (
              <tr key={m.med_id}>
                <td className="td font-medium">{m.name}</td>
                <td className="td">{money(m.unit_price)}</td>
                <td className="td">{m.stock_qty}</td>
                <td className="td">{m.reorder_level}</td>
                <td className="td">{m.expiry_date}</td>
                <td className="td">{alertFor(m.med_id) && <span className={`badge ${ALERT_STYLE[alertFor(m.med_id)]}`}>{alertFor(m.med_id)}</span>}</td>
                <td className="td">
                  <div className="flex gap-1">
                    <input className="input w-20" type="number" min="1" placeholder="Qty" value={restockQty[m.med_id] || ""} onChange={(e) => setRestockQty({ ...restockQty, [m.med_id]: e.target.value })} />
                    <button className="btn-secondary" disabled={!restockQty[m.med_id]} onClick={() => restock(m.med_id)}>Add</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
