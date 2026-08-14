import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import styles from "./AdminShell.module.css";

export function AdminShell() {
  const navigate = useNavigate();

  return (
    <div className={styles.shell}>
      <aside className={styles.side} aria-label="后台导航">
        <div className={styles.badge}>内容后台</div>
        <nav className={styles.nav}>
          <NavLink to="/admin" end>
            概览
          </NavLink>
          <NavLink to="/admin/recipes">配方</NavLink>
          <NavLink to="/admin/ingredients">材料</NavLink>
          <NavLink to="/admin/taxonomy">家族与风味</NavLink>
        </nav>
        <div className={styles.sideActions}>
          <button
            type="button"
            className={styles.logout}
            onClick={() => {
              void api.adminLogout().finally(() => {
                navigate("/admin/login", { replace: true });
              });
            }}
          >
            退出登录
          </button>
          <NavLink to="/" className={styles.exit}>
            ← 返回前台
          </NavLink>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
