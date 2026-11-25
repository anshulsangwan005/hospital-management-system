const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const getToken = () => localStorage.getItem("token");
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};
export const saveSession = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};
export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(BASE + path, { ...options, headers });
  if (res.status === 401 && !path.startsWith("/auth/login")) {
    logout();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data?.detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((e) => e.msg).join("; ") : res.statusText;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: (p, body) => request(p, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
};

export const money = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n || 0));
