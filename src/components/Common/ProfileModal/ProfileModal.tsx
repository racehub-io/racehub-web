import React from "react";
import { FiX } from "react-icons/fi";

import { Profile } from "./Profile";
import { Props } from "./ProfileModal.types";
import styles from "./ProfileModal.module.scss";

export function ProfileModal(props: Props) {
  const { onClose } = props;
  return (
    <>
      <div className={styles.background} />
      <div className={styles.modal}>
        {onClose && <FiX className={styles.closeButton} onClick={onClose} />}
        <Profile />
      </div>
    </>
  );
}
