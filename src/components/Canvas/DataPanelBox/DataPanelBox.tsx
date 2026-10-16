import React, { useState, FocusEvent } from "react";
import classnames from "classnames";
import { Props } from "./DataPanelBox.types";

import styles from "./DataPanelBox.module.scss";

// This is the wrapper for DataPanels, adds border, and generic controls
export function DataPanelBox(props: Props) {
  const { children } = props;
  const [boxIsFocused, setBoxIsFocused] = useState(false);
  // const [boxIsDragging, setBoxIsDragging] = useState(false);

  const title = children?.props.title;
  const hasTitle = title && title.length > 0;

  const handleContentFocus = (event: FocusEvent<HTMLDivElement>) => {
    setBoxIsFocused(event.type === "focus");
  };

  // const handleBoxDragging = (event: DragEvent<HTMLDivElement>) => {
  //   setBoxIsDragging(false);
  // };

  return (
    <div
      className={classnames(
        styles.dataPanelBox,
        boxIsFocused && styles.boxIsFocused
      )}
    >
      <div
        className={"handle"}
        style={{
          display: hasTitle ? "block" : "none",
          position: "absolute",
          width: "100%",
          height: "45px",
          top: "0",
          backgroundColor: "#1b2337",
          borderTopLeftRadius: "10px",
          borderTopRightRadius: "10px",
        }}
      />
      {hasTitle && <div className={styles.title}>{title}</div>}
      {/*showScrollHint && (
        <div
          className={classnames(
            styles.scrollInput,
            boxIsFocused && styles.showScrollInput
          )}
        >
          <kbd className={styles.keyboardKey}>←</kbd>
          <kbd className={styles.keyboardKey}>→</kbd>
        </div>
      )*/}
      <div
        className={classnames(styles.content, hasTitle && styles.titleHeader)}
        tabIndex={0}
        onFocus={handleContentFocus}
        onBlur={handleContentFocus}
      >
        {children}
      </div>
    </div>
  );
}
