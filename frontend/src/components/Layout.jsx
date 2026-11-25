import { NavLink, useNavigate } from "react-router-dom";
import { getUser, logout } from "../api";
import { NAV } from "../App.jsx";

export default function Layout({ children }) {
  const user = getUser();
  const navigate = useNavigate();
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-100">
        <div className="px-5 py-5">
          <div className="text-lg font-bold text-teal-400">Smart Hospital</div>
          <div className="text-xs text-slate-400">Management System</div>
        </div>
        <nav className="space-y-1 px-3">
          {items.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.path === "/"}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm">
            <span className="font-medium">{user.username}</span>
            <span className="ml-2 badge bg-teal-100 text-teal-800">{user.role}</span>
          </div>
          <button
            className="btn-secondary"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ children, sub }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

export function ErrorMsg({ error }) {
  if (!error) return null;
  return <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>;
}

export function OkMsg({ msg }) {
  if (!msg) return null;
  return <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>;
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
