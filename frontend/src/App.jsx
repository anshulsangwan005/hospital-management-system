import { Navigate, Route, Routes } from "react-router-dom";
import { getUser } from "./api";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import Appointments from "./pages/Appointments.jsx";
import Beds from "./pages/Beds.jsx";
import Inventory from "./pages/Inventory.jsx";
import Billing from "./pages/Billing.jsx";

// Role-based UI: which roles may open which page (mirrors the backend RBAC)
export const NAV = [
  { path: "/", label: "Dashboard", roles: ["admin", "doctor", "receptionist", "pharmacist"], element: <Dashboard /> },
  { path: "/patients", label: "Patients", roles: ["admin", "doctor", "receptionist"], element: <Patients /> },
  {
    path: "/appointments",
    label: "Appointments",
    roles: ["admin", "doctor", "receptionist", "patient"],
    element: <Appointments />,
  },
  { path: "/beds", label: "Beds & Admissions", roles: ["admin", "doctor", "receptionist"], element: <Beds /> },
  { path: "/inventory", label: "Pharmacy", roles: ["admin", "pharmacist"], element: <Inventory /> },
  { path: "/billing", label: "Billing", roles: ["admin", "receptionist", "patient"], element: <Billing /> },
];

export const homeFor = (role) => (role === "patient" ? "/appointments" : "/");

function Protected({ roles, children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {NAV.map((n) => (
        <Route key={n.path} path={n.path} element={<Protected roles={n.roles}>{n.element}</Protected>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
