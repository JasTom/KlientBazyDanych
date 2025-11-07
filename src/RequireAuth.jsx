import { useEffect, useState } from "react";
import { BACKEND_BASE_URL } from "./apiClient";
import { Outlet } from "react-router-dom";

export default function RequireAuth() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Weryfikacja wyłącznie po stronie backendu (działa także dla HttpOnly)
    fetch(`${BACKEND_BASE_URL}/auth/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated) {
          setAllowed(true);
        } else {
          const loginUrl = data?.login_url || "/login";
          if (typeof window !== "undefined") {
            window.location.href = loginUrl;
          }
        }
      })
      .catch(() => {
        const fallback = "/login";
        if (typeof window !== "undefined") {
          window.location.href = fallback;
        }
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!allowed) return null;
  return <Outlet />;
}


