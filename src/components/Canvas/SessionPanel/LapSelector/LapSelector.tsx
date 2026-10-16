import React, { useState } from "react";
import { ColorChangeHandler, GithubPicker } from "react-color";
import classnames from "classnames";
import {
  SELECT_COLOR,
  SELECT_PRIMARY_LAP,
  TRIGGER_LAP_SELECTION,
} from "../../../../modules/race/actions";
import { useDispatch, useStore } from "../../../../modules/context";
import styles from "./LapSelector.module.scss";
import { Props } from "./LapSelector.types";

function millisToMinutesAndSeconds(time: number) {
  const minutes = Math.floor(time / 60);
  const s = Number(time % 60);
  const seconds = Number(s.toFixed(0));
  const milliseconds = s.toFixed(3).split(".")[1];

  return (
    minutes + ":" + (seconds < 10 ? "0" : "") + seconds + "." + milliseconds
  );
}

export function LapSelector(props: Props) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const { dispatch } = useDispatch();
  const { store } = useStore();
  const { selectedLaps, selectedLapsColors, primaryLapId } = store;
  const { lap, lapNumber } = props;

  const lapTime = lap.endTime ? (lap.endTime - lap.startTime) * 1000 : 0;

  const handleSelectLap = async () => {
    dispatch({
      type: TRIGGER_LAP_SELECTION,
      lap,
    });
  };

  const handleSelectPrimaryLap = () => {
    dispatch({
      type: SELECT_PRIMARY_LAP,
      primaryLapId: lap.lapId,
    });
  };

  const handleChangeComplete = (color: any) => {
    dispatch({ type: SELECT_COLOR, lapId: lap.lapId, color: color.hex });
  };

  const handleColorPicker = () => {
    setColorPickerOpen((prevValue) => !prevValue);
  };

  const isLapSelected = !!selectedLaps[lap.lapId];

  const lapIncomplete = lapTime ? `` : `${styles.lapIncomplete}`;
  const lapClasses = `${styles.lap} ${lapIncomplete}`

  return (
    <div className={styles.lapWrapper}>
      <div className={lapClasses} onClick={handleSelectLap}>
        <div
          className={styles.status}
          style={{
            backgroundColor: isLapSelected
              ? selectedLapsColors[lap.lapId]
              : "#cacaca20",
          }}
        />
        <div className={styles.lapInfo}>
          Lap {lapNumber}
          <span className={styles.lapTime}>
            {lapTime ? millisToMinutesAndSeconds(lapTime / 1000) : 'Incomplete'}
          </span>
          {lap.participant && (
            <span className={styles.driverName}>
              {lap.participant.firstName[0]}. {lap.participant.lastName} ({lap.participant.name}) #{lap.participant.raceNumber}
            </span>
          )}
        </div>
      </div>{" "}
      {isLapSelected && (
        <>
          <div
            onClick={handleSelectPrimaryLap}
            className={classnames(
              styles.primaryButton,
              lap.lapId === primaryLapId && styles.selectedPrimaryButton
            )}
          >
            P
          </div>
          <div
            onClick={handleColorPicker}
            className={classnames(
              styles.primaryButton,
              colorPickerOpen && styles.selectedPrimaryButton,
              styles.colorButton
            )}
          >
            C
            {colorPickerOpen && (
              <div
                style={{
                  top: "30px",
                  right: "-8px",
                  position: "absolute",
                  zIndex: 1,
                }}
              >
                <GithubPicker
                  onChangeComplete={handleChangeComplete}
                  width="100px"
                  triangle="top-right"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
