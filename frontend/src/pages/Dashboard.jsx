import { useEffect, useState } from "react";
import { api, getUser, money } from "../api";
import { ErrorMsg, PageTitle } from "../components/Layout.jsx";

function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const user = getUser();
  const [s, setS] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/analytics/summary").then(setS).catch((e) => setError(e.message));
    if (["admin", "receptionist"].includes(user.role)) {
      api.get("/analytics/revenue").then(setRevenue).catch(() => {});
    }
  }, []);

  const max = Math.max(1, ...revenue.map((r) => Number(r.revenue)));

  return (
    <>
      <PageTitle sub="Live numbers computed inside PostgreSQL (fn_dashboard_summary)">Dashboard</PageTitle>
      <ErrorMsg error={error} />
      {s && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Patients" value={s.patients} />
          <Stat label="Appointments today" value={s.appointments_today} />
          <Stat label="Beds available" value={`${s.beds_available} / ${s.beds_total}`} hint={`${s.active_admissions} admitted`} />
          <Stat label="Stock alerts" value={s.low_stock_alerts} hint="low / expiring / expired" />
          {["admin", "receptionist"].includes(user.role) && (
            <>
              <Stat label="Revenue today" value={money(s.revenue_today)} />
              <Stat label="Revenue this month" value={money(s.revenue_month)} />
              <Stat label="Outstanding" value={money(s.outstanding_balance)} />
            </>
          )}
        </div>
      )}
      {revenue.length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-3 text-sm font-semibold">Revenue - last 30 days</h2>
          <div className="flex h-40 items-end gap-1">
            {revenue.map((r) => (
              <div key={r.day} className="group relative flex-1 rounded-t bg-teal-500" style={{ height: `${(Number(r.revenue) / max) * 100}%` }}>
                <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-xs text-white group-hover:block">
                  {r.day}: {money(r.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
