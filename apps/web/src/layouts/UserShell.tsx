import { NavLink, Outlet } from "react-router-dom";
import styles from "./UserShell.module.css";

export function UserShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} end>
          鸡尾酒工具
        </NavLink>
        <nav className={styles.nav} aria-label="主导航">
          <NavLink to="/" end>
            配方
          </NavLink>
          <NavLink to="/bar">酒柜</NavLink>
          <NavLink to="/ai">AI 助手</NavLink>
        </nav>
      </header>
      <div className={styles.scroll}>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <footer className={styles.footer}>
        <span className={styles.footerNote}>内容仅保存在本地</span>
        <NavLink to="/admin" className={styles.footerAdmin}>
          管理
        </NavLink>
      </footer>
    </div>
  );
}
