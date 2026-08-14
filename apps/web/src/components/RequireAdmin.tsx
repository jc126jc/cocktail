import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/client";

export function RequireAdmin() {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");

  useEffect(() => {
    let cancelled = false;
    void api
      .adminSession()
      .then((s) => {
        if (!cancelled) setState(s.authenticated ? "ok" : "deny");
      })
      .catch(() => {
        if (!cancelled) setState("deny");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return <p style={{ padding: "1.5rem" }}>正在确认登录…</p>;
  }
  if (state === "deny") {
    return (
      <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
    );
  }
  return <Outlet />;
}
