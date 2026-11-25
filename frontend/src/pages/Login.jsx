import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveSession } from "../api";
import { homeFor } from "../App.jsx";
import { ErrorMsg } from "../components/Layout.jsx";

const DEMO = [
  ["admin", "admin123"],
  ["doctor1", "doctor123"],
  ["reception", "reception123"],
  ["pharma", "pharma123"],
  ["patient1", "patient123"],
];

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token, user } = await api.post("/auth/login", { username, password });
      saveSession(token, user);
      navigate(homeFor(user.role));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <div>
          <h1 className="text-xl font-bold text-teal-700">Smart Hospital</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        <ErrorMsg error={error} />
        <input className="input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        <div className="border-t pt-3 text-xs text-slate-500">
          <div className="mb-1 font-medium">Demo accounts (click to fill):</div>
          <div className="flex flex-wrap gap-1">
            {DEMO.map(([u, p]) => (
              <button type="button" key={u} className="badge bg-slate-100 hover:bg-slate-200" onClick={() => { setUsername(u); setPassword(p); }}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
