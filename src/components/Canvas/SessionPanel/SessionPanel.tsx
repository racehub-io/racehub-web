import React, { useEffect, useState } from "react";
import { Props } from "./SessionPanel.types";
import { LapSelector } from "./LapSelector";
import { FaRoad, FaWind } from "react-icons/fa";
import { useStore } from "../../../modules/context";
import { getLap, getParticipant } from "../../../firebase";
import { getTrackFlag, getWeatherIcon } from "./helpers";
import { Lap } from "../../../types";
import styles from "./SessionPanel.module.scss";

export function SessionPanel(props: Props) {
  // 0 = driver, 1 = ascending (all), 2 = descending(all)
  // TODO: type this into an enum
  const [orderMode, setOrderMode] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const { store } = useStore();
  const { selectedSession } = store;

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    (async () => {
      for (let lapId of selectedSession.lapIds) {
        const lap = await getLap(lapId);
        if (lap) {
          lap.participant = await getParticipant(lap.participantId);
          setLaps((prevLaps: Lap[]) => [...prevLaps, lap]);
        }
      }
    })();
  }, [selectedSession]);

  if (!laps || Object.keys(laps).length === 0 || !selectedSession) {
    return <div />;
  }

  const orderedLaps = orderLaps(laps, orderMode);
  const trackFlag = getTrackFlag(selectedSession.trackName);
  const WeatherIcon = getWeatherIcon(selectedSession.weather);

  const handleSort = () =>
    setOrderMode((prevOrderMode) =>
      prevOrderMode === 2 ? 0 : prevOrderMode + 1
    );

  return (
    <div className={styles.sessionPanel}>
      <div className={styles.trackInformationWrapper}>
        <div className={styles.trackInformationLeft}>
          <img
            alt={selectedSession.trackName}
            className={styles.trackFlag}
            src={trackFlag}
          />
          <div className={styles.trackInformation}>
            <span className={styles.trackName}>
              {selectedSession.trackName}
            </span>
            <span className={styles.sessionType}>
              {selectedSession.sessionType}
            </span>
          </div>
        </div>
        <div className={styles.weatherInformation}>
          <div className={styles.temperatureWrapper}>
            <span title={"Air temperature"} className={styles.temperatureInfo}>
              <FaWind className={styles.temperatureIcon} />
              {selectedSession.airTemperature}°
            </span>
            <span
              title={"Track temperature"}
              className={styles.temperatureInfo}
            >
              <FaRoad className={styles.temperatureIcon} />
              {selectedSession.trackTemperature}°
            </span>
          </div>
          <div className={styles.separator} />
          <WeatherIcon
            title={selectedSession.weather}
            className={styles.weatherIcon}
          />
        </div>
      </div>
      <div className={styles.lapSelector}>
        <span className={styles.sortLabel} onClick={handleSort}>
          Sort by{" "}
          <span className={styles.sortType}>{getSortingName(orderMode)}</span>
        </span>
        <div className={styles.lapsWrapper}>
          {laps.map((lap: Lap, index: number) => (
            <LapSelector
              key={lap.lapId}
              lap={lap}
              lapNumber={index + 1}
              displayDriverName={true}
              uniqueSessionId={selectedSession.uniqueSessionId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function orderLaps(laps: Lap[], orderMode: number) {
  return laps.sort((lapA: any, lapB: any) => {
    const lapATime = lapA.endTime - lapA.startTime;
    const lapBTime = lapB.endTime - lapB.startTime;
    if (orderMode === 1) {
      return lapATime > lapBTime ? 1 : -1;
    } else if (orderMode === 2) {
      return lapATime < lapBTime ? 1 : -1;
    }
    return 0;
  });
}

function getSortingName(orderMode: number) {
  switch (orderMode) {
    case 0:
      return "driver";
    case 1:
      return "time asc";
    case 2:
      return "time desc";
    default:
      return;
  }
}
