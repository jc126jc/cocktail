import { Link } from "react-router-dom";
import styles from "./admin.module.css";

export function AdminHomePage() {
  return (
    <div className={styles.stack}>
      <h1>内容后台</h1>
      <p className={styles.muted}>发布或删除前会再确认一次。</p>
      <div className={styles.card}>
        <h2>快捷入口</h2>
        <div className={styles.row}>
          <Link to="/admin/recipes">管理配方</Link>
          <Link to="/admin/ingredients">管理材料</Link>
          <Link to="/admin/taxonomy">家族与风味</Link>
        </div>
        <p className={styles.muted}>
          想出现在首页推荐：编辑配方时勾选「放在首页推荐」并设顺序。基酒要能被前台酒类找到：在材料页选对应的「酒体偏好」。
        </p>
      </div>
    </div>
  );
}
