import React, { useState } from "react";
import classnames from "classnames";

import { useDispatch, useStore } from "../../../modules/context";
import {
  END_LOAD_RACE_FILE,
  SELECT_PARTICIPANTS,
} from "../../../modules/race/actions";
import styles from "./Toast.module.scss";

// this should be a generic component
export function Toast() {
  const [selectedParticipants, setSelectedParticipants]: any = useState([]);
  const [disabled, setDisabled] = useState(false);
  const { dispatch } = useDispatch();
  const {
    store: { participants },
  } = useStore();

  const onTriggerDriverById = (participantId: number) => {
    if (selectedParticipants.includes(participantId)) {
      setSelectedParticipants((prevParticipants: any) =>
        prevParticipants.filter((p: any) => p !== participantId)
      );
    } else {
      setSelectedParticipants((prevParticipants: any) => [
        ...prevParticipants,
        participantId,
      ]);
    }
  };

  const onTriggerDriver = (event: any) => {
    const participantId = Number(event.target.value);
    onTriggerDriverById(participantId);
  };

  const handleCancel = () => {
    setDisabled(true);
    dispatch({ type: END_LOAD_RACE_FILE });
    dispatch({ type: SELECT_PARTICIPANTS, selectedParticipants: [] });
  };

  const handleAccept = () => {
    setDisabled(true);
    dispatch({ type: SELECT_PARTICIPANTS, selectedParticipants });
  };

  return (
    <div className={styles.toastBackground}>
      <div className={styles.toastWrapper}>
        <div className={styles.toast}>
          <div className={styles.title}>Select Drivers To Import</div>
          <div className={styles.participantsList}>
            {participants
              .filter((participantName: string) => participantName.length > 0)
              .map((participant: string, participantIndex: number) => (
                <div
                  className={styles.participant}
                  key={`participant-list-${participant}-${participantIndex}`}
                >
                  <input
                    name={participant}
                    value={participantIndex}
                    type="checkbox"
                    onChange={onTriggerDriver}
                    className={styles.checkbox}
                    checked={selectedParticipants.includes(participantIndex)}
                    disabled={
                      !selectedParticipants.includes(participantIndex) &&
                      selectedParticipants.length > 4
                    }
                  />
                  <div
                    className={styles.name}
                    onClick={() => onTriggerDriverById(participantIndex)}
                  >
                    {participant}
                  </div>
                </div>
              ))}
          </div>
          <div className={styles.buttons}>
            <div
              className={classnames(styles.cancel, disabled && styles.disabled)}
              onClick={() =>
                (selectedParticipants.length > 0 || !disabled) && handleCancel()
              }
            >
              Cancel
            </div>
            <div
              className={classnames(
                styles.accept,
                (selectedParticipants.length === 0 || disabled) &&
                  styles.disabled
              )}
              onClick={() =>
                (selectedParticipants.length > 0 || !disabled) && handleAccept()
              }
            >
              Accept
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
