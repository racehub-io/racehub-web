import React, { useEffect } from "react";
import firebase from "firebase";
import { FiX } from "react-icons/fi";
import StyledFirebaseAuth from "react-firebaseui/StyledFirebaseAuth";

import { AnimatedLogo } from "../AnimatedLogo";

import styles from "./AuthenticationModal.module.scss";
import { Props } from "./AuthenticationModal.types";

const uiConfig: firebaseui.auth.Config = {
  signInFlow: "popup",
  signInSuccessUrl: "/",
  callbacks: {
    signInSuccessWithAuthResult: () => false,
  },
  signInOptions: [firebase.auth.EmailAuthProvider.PROVIDER_ID],
};

export function AuthenticationModal(props: Props) {
  const { onClose } = props;

  return (
    <>
      <div className={styles.background} />
      <div className={styles.modal}>
        {onClose && <FiX className={styles.closeButton} onClick={onClose} />}
        <AnimatedLogo size={110} />
        <div style={{ height: "35px" }} />
        <StyledFirebaseAuth
          uiConfig={uiConfig}
          firebaseAuth={firebase.auth()}
        />
      </div>
    </>
  );
}
