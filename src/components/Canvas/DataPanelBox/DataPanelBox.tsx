import React from "react";
import { Props } from "./DataPanelBox.types";
import styles from "./DataPanelBox.module.scss";

export function DataPanelBox({ children }: Props) {
  const title = children?.props.title;
  return <div className={styles.dataPanelBox}>
    {title && <div className={`${styles.title} handle`}>{title}</div>}
    <div className={`${styles.content} ${title ? styles.titleHeader : ""}`} tabIndex={0}>
      {children}
    </div>
  </div>;
}
