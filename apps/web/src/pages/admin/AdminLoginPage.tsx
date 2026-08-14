import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import styles from "./admin.module.css";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from ?? "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.adminLogin(password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "口令不对。"
          : err instanceof ApiError
            ? err.message
            : "没能登录。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.loginShell}>
      <form className={`${styles.form} ${styles.loginCard}`} onSubmit={onSubmit}>
        <h1>内容后台登录</h1>
        <p className={styles.muted}>
          输入本机管理口令。忘记的话，看项目文档里的默认口令说明。
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <label>
          口令
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <div className={styles.row}>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
          >
            {busy ? "登录中…" : "登录"}
          </button>
          <Link to="/" className={styles.muted}>
            回前台
          </Link>
        </div>
      </form>
    </div>
  );
}
