import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1>App Math SMP</h1>
        <p>Platform Belajar Matematika Asik dan Menyenangkan</p>
        <div className={styles.actions}>
          <Link href="/login" className={styles.buttonPrimary}>Login</Link>
        </div>
      </div>
    </main>
  );
}
