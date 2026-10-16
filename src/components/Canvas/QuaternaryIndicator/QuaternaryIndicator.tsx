import * as React from "react";
import { RangedValueIndicator } from "../RangedValueIndicator";
import { Props } from "./QuaternaryIndicator.types";

import styles from "./QuaternaryIndicator.module.scss";

export function QuaternaryIndicator(props: Props) {
  const { values, minValue, maxValue, unit } = props;

  if (!values) {
    return <div />;
  }

  return (
    <div className={styles.quaternaryIndicator}>
      <div className={styles.quaternaryIndicatorRow}>
        <RangedValueIndicator
          minValue={minValue}
          maxValue={maxValue}
          title={`Front Left`}
          unit={unit}
          value={values[2]}
        />
        <RangedValueIndicator
          minValue={minValue}
          maxValue={maxValue}
          title={`Front Right`}
          unit={unit}
          value={values[3]}
        />
      </div>
      <div className={styles.quaternaryIndicatorRow}>
        <RangedValueIndicator
          minValue={minValue}
          maxValue={maxValue}
          title={`Rear Left`}
          unit={unit}
          value={values[0]}
        />
        <RangedValueIndicator
          minValue={minValue}
          maxValue={maxValue}
          title={`Rear Right`}
          unit={unit}
          value={values[1]}
        />
      </div>
    </div>
  );
}
