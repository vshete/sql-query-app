import Link from "next/link";
import QueryWorkspace from "./AIQueryBuilder/QueryWorkspace";
import { WorkspaceIcon } from "./WorkspaceIcon";
import styles from "./AIQueryBuilder/queryAgent.module.css";

/** Render the server shell around the interactive query workspace. */
export const AppEntry = () => (
  <div className={styles.appShell}>
    <header className={styles.appHeader}>
      <Link href="/" className={styles.brand} aria-label="Query Studio home">
        <span className={styles.brandIcon}>
          <WorkspaceIcon name="terminal" size={18} />
        </span>
        Query Studio
      </Link>
      <span className={styles.headerDivider} />
      <span className={styles.headerCaption}>SQL workspace</span>
      <span className={styles.headerMeta}>
        PostgreSQL <span> / </span> AI assisted
      </span>
    </header>
    <div className={styles.workspace}>
      <QueryWorkspace />
    </div>
  </div>
);
