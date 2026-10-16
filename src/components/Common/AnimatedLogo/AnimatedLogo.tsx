import React from "react";
import { Streamgraph } from "../Streamgraph";

import { Props } from "./AnimatedLogo.types";
import styles from "./AnimatedLogo.module.scss";

export function AnimatedLogo(props: Props) {
  const { size } = props;

  return (
    <div
      className={styles.logo}
      style={{ width: `${size - 50}px`, height: `${size - 50}px` }}
    >
      <div className={styles.graph}>
        <Streamgraph width={size} height={size} multiplier={1} />
      </div>
    </div>
  );
}
