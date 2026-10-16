import React, { useState } from "react";
import { Link } from "react-router-dom";
import classnames from "classnames";
import { useStore } from "../../../modules/context";
import logo from "../../../assets/icon.svg";
import { firebaseApp } from "../../../firebase";

import styles from "./Navbar.module.scss";

type Props = {
  openAuthModal: any;
  openProfileModal: any;
};

export function Navbar(props: Props) {
  const { openAuthModal, openProfileModal } = props;
  const [isHoveringUser, setIsHoveringUser] = useState(false);
  const {
    store: { user },
  } = useStore();

  return (
    <div className={styles.navbar}>
      <div className={classnames(styles.background, styles.solidBackground)} />
      <div className={styles.raceHub}>
        <img src={logo} className={styles.logo} />
        <span className={styles.title}>RaceHub</span>
      </div>
      <div className={styles.buttons}>
        <Link to="/analyser" className={styles.actionButton}>Launch Analyser</Link>
        {user ? (
          <>
            <div
              className={styles.userButton}
              onMouseOver={() => setIsHoveringUser(true)}
              onMouseOut={() => setIsHoveringUser(false)}
              onClick={openProfileModal}
            >
              <div className={styles.name}>
                {isHoveringUser
                  ? "Open Profile"
                  : user.displayName?.split(" ")[0] || "user"}
              </div>
            </div>
          </>
        ) : firebaseApp && (
          <div className={styles.actionButton} onClick={openAuthModal}>
            Sign In
          </div>
        )}
      </div>
    </div>
  );
}
