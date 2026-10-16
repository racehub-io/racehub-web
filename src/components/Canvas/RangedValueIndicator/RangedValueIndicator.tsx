import * as React from "react";
import { Props } from "./RangedValueIndicator.types";
import classNames from "classnames";

import styles from "./RangedValueIndicator.module.scss";

export class RangedValueIndicator extends React.PureComponent<Props> {
  render() {
    const { title, minValue, maxValue, unit, className } = this.props;
    let { value } = this.props;

    const valuePercentage = ((value - minValue) / (maxValue - minValue)) * 100;

    let backgroundPosition = valuePercentage;
    if (value < minValue) {
      backgroundPosition = 0;
    } else if (value > maxValue) {
      backgroundPosition = 100;
    }

    if (!value) {
      value = 0;
    }

    const formattedValue = unit ? `${value}${unit}` : value;

    const RangedValueIndicatorClassnames = classNames(
      styles.RangedValueIndicator,
      className
    );

    return (
      <div
        className={RangedValueIndicatorClassnames}
        style={{ backgroundPosition: `${backgroundPosition}% 0%` }}
      >
        <span className={styles.title}>{title}</span>
        <span className={styles.value}>{formattedValue}</span>
      </div>
    );
  }
}
