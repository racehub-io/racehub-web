import React from "react";
import classnames from "classnames";
import styles from "./ActionButton.module.scss";

type Props = {
  onClick: () => void;
  icon?: JSX.Element;
  className?: string;
  label: string;
  disabled?: boolean;
};

export function ActionButton(props: Props) {
  return (
    <div
      className={classnames(
        props.className,
        props.disabled && styles.disabled,
        styles.actionButton
      )}
      onClick={() => !props.disabled && props.onClick()}
    >
      {props.icon ? props.icon : null}
      {props.label}
    </div>
  );
}
