import { useEffect, useState } from "react";
import { api, getUser, money } from "../api";
import { ErrorMsg, Field, OkMsg, PageTitle } from "../components/Layout.jsx";

const STATUS_STYLE = {
  Pending: "bg-rose-100 text-rose-800",
  Partial: "bg-amber-100 text-amber-800",
  Paid: "bg-emerald-100 text-emerald-800",
};

export default function Billing() {
  const user = getUser();
  const staff = ["admin", "receptionist"].includes(user.role);

  const [bills, setBills] = useState([]);
  const [detail, setDetail] = useState(null);
  const [pay, setPay] = useState({ amount: "", method: "Cash" });
  const [item, setItem] = useState({ description: "", quantity: 1, unit_price: "" });
  const [apptId, setApptId] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = () => api.get("/bills").then(setBills).catch((e) => setError(e.message));
  const open = (id) => api.get(`/bills/${id}`).then(setDetail).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (fn, msg) => {
    setError(""); setOk("");
    try {
      const r = await fn();
      if (msg) setOk(typeof msg === "function" ? msg(r) : msg);
      await load();
      if (detail) await open(detail.bill_id);
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <PageTitle sub="Totals and status are maintained by database triggers">Billing</PageTitle>
      <ErrorMsg error={error} />
      <OkMsg msg={ok} />

      {staff && (
        <div className="card mb-5 flex flex-wrap items-end gap-3">
          <Field label="Create consultation bill from appointment ID">
            <input className="input w-48" type="number" min="1" value={apptId} onChange={(e) => setApptId(e.target.value)} />
          </Field>
          <button className="btn" disabled={!apptId}
            onClick={() => run(() => api.post(`/bills/consultation/${apptId}`), (r) => `Bill #${r.bill_id} created`)}>
            Generate bill
          </button>
          <span className="text-xs text-slate-500">Discharging a patient (Beds page) creates the bed-charge bill automatically.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead><tr>{["#", "Patient", "Total", "Paid", "Balance", "Status"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.bill_id} className="cursor-pointer hover:bg-slate-50" onClick={() => open(b.bill_id)}>
                  <td className="td">{b.bill_id}</td><td className="td">{b.patient_name}</td>
                  <td className="td">{money(b.total_amount)}</td><td className="td">{money(b.paid)}</td>
                  <td className="td">{money(b.balance)}</td>
                  <td className="td"><span className={`badge ${STATUS_STYLE[b.status]}`}>{b.status}</span></td>
                </tr>
              ))}
              {bills.length === 0 && <tr><td className="td text-slate-400" colSpan={6}>No bills</td></tr>}
            </tbody>
          </table>
        </div>

        {detail && (
          <div className="card">
            <h2 className="mb-1 text-lg font-semibold">Invoice #{detail.bill_id}</h2>
            <p className="mb-3 text-sm text-slate-500">{detail.patient_name} - {new Date(detail.bill_date).toLocaleDateString()}</p>
            <table className="mb-3 w-full text-sm">
              <thead><tr><th className="th">Item</th><th className="th">Qty</th><th className="th">Price</th><th className="th">Total</th></tr></thead>
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.item_id}><td className="td">{i.description}</td><td className="td">{i.quantity}</td><td className="td">{money(i.unit_price)}</td><td className="td">{money(i.line_total)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mb-3 space-y-0.5 text-right text-sm">
              <div>Total: <b>{money(detail.total_amount)}</b></div>
              <div>Paid: {money(detail.paid)}</div>
              <div>Balance: <b>{money(detail.balance)}</b></div>
            </div>

            {detail.payments.length > 0 && (
              <div className="mb-3 text-xs text-slate-600">
                <div className="mb-1 font-semibold">Payments</div>
                {detail.payments.map((p) => <div key={p.pay_id}>{new Date(p.paid_at).toLocaleString()} - {p.method} - {money(p.amount)}</div>)}
              </div>
            )}

            {staff && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Add line item"><input className="input w-44" placeholder="Description" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} /></Field>
                  <Field label="Qty"><input className="input w-16" type="number" min="1" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} /></Field>
                  <Field label="Price"><input className="input w-24" type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => setItem({ ...item, unit_price: e.target.value })} /></Field>
                  <button className="btn-secondary" disabled={!item.description || item.unit_price === ""}
                    onClick={() => run(() => api.post(`/bills/${detail.bill_id}/items`, { description: item.description, quantity: Number(item.quantity), unit_price: item.unit_price }), "Item added").then(() => setItem({ description: "", quantity: 1, unit_price: "" }))}>
                    Add
                  </button>
                </div>
                {Number(detail.balance) > 0 && (
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Record payment">
                      <input className="input w-32" type="number" min="0.01" step="0.01" placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                    </Field>
                    <Field label="Method">
                      <select className="input w-28" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                        {["Cash", "Card", "UPI", "Insurance"].map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </Field>
                    <button className="btn" disabled={!pay.amount}
                      onClick={() => run(() => api.post(`/bills/${detail.bill_id}/payments`, { amount: pay.amount, method: pay.method }), "Payment recorded").then(() => setPay({ ...pay, amount: "" }))}>
                      Pay
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
