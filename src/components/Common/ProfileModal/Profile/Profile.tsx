import React from "react";
import firebase from "firebase";
import { useDispatch, useStore } from "../../../../modules/context";
import { SIGN_OUT_USER } from "../../../../modules/race/actions";

import styles from "./Profile.module.scss";
import { ActionButton } from "../../ActionButton";

export function Profile() {
  const {
    store: { user },
  } = useStore();
  const { dispatch } = useDispatch();

  if (!user) {
    return <div>Please log in</div>;
  }

  const signOut = () => {
    firebase.auth().signOut();
    dispatch({ type: SIGN_OUT_USER });
  };

  return (
    <div className={styles.profileWrapper}>
      <div className={styles.panelsWrapper}>
        <div className={styles.panel}>
          <div className={styles.content}>
            <span className={styles.title}>Information</span>
            {user.photoURL && (
              <img
                className={styles.profilePicture}
                alt={"Profile"}
                src={user.photoURL}
              />
            )}
            <div className={styles.information}>
              <div className={styles.subtitle}>Name</div>
              <div className={styles.name}>{user.displayName}</div>
            </div>
            <div className={styles.information}>
              <div className={styles.subtitle}>Email</div>
              <div className={styles.name}>{user.email}</div>
            </div>
            <ActionButton className={styles.logout} onClick={signOut} label={"Log Out"} />
            {/* <div className={styles.name}>Email Verified: Check</div> */}
            {/* <div className={styles.name}>Password: *****</div> */}
            {/* <div>Edit Profile</div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
