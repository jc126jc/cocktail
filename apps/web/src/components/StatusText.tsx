import styles from "./StatusText.module.css";

export function MissingStatus({ count }: { count: number }) {
  if (count <= 0) {
    return <span className={`${styles.type} ${styles.complete}`}>材料齐全</span>;
  }
  return (
    <span className={`${styles.type} ${styles.missing}`}>缺 {count} 种</span>
  );
}

export function OwnStatus({ owned }: { owned: boolean }) {
  return owned ? (
    <span className={styles.owned}>已有</span>
  ) : (
    <span className={styles.lack}>缺少</span>
  );
}
