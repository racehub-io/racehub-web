import React, { useEffect, useState } from "react";
import { AiOutlineLoading } from "react-icons/ai";
import { FaRoad, FaWind } from "react-icons/fa";
import { getTrackFlag } from "./helpers";
import { useDispatch, useStore } from "../../../modules/context";
import { getParticipant, getSession, getUser } from "../../../firebase";
import { Session, User } from "../../../types";
import { SELECT_SESSION } from "../../../modules/race/actions";
import styles from "./Explorer.module.scss";

export function Explorer(props: any) {
  const { store } = useStore();
  const { dispatch } = useDispatch();
  const [sessions, setSessions] = useState<{ [sessionId: string]: Session }>(
    {}
  );

  useEffect(() => {
    (async () => {
      const user = await getUser();
      if (!user) return;

      const { sessionIds } = user as User;
      for (let i = 0; i < sessionIds.length; i++) {
        const sessionId = sessionIds[i];
        const session = await getSession(sessionId);

        if (!session || !session.participantIds) continue;

        const participants = [];
        for (let j = 0; j < session.participantIds.length; j++) {
          const participant = await getParticipant(session.participantIds[j]);
          if (!participant) continue;
          participants.push(participant);
        }
        session.participants = participants;

        if (session) {
          setSessions((prevSessions) => ({
            ...prevSessions,
            [session?.sessionId]: session,
          }));
        }
      }
    })();
  }, []);

  if (!sessions) {
    return <div className={styles.noRecordingsText}>No recordings found</div>;
  }

  const handleRowClick = (session: Session, participantId: string) => {
    dispatch({
      type: SELECT_SESSION,
      session,
    });
    props.onLoadSession(
      session.uniqueSessionId,
      store.user?.uid,
      participantId
    );
  };

  return (
    <div className={styles.explorerWrapper}>
      <div className={styles.titleWrapper}>
        {store.isParsing && (
          <AiOutlineLoading
            className={`${styles.icon} ${styles.loadingIcon}`}
          />
        )}
      </div>
      <table className={styles.table}>
        <tbody>
          {Object.values(sessions).map((session: Session) => {
            return session.participantIds.map((participantId: string) => (
              <tr
                className={styles.tr}
                key={session.sessionId}
                onClick={() => handleRowClick(session, participantId)}
              >
                <td className={styles.td}>
                  <img
                    alt={session.trackName}
                    className={styles.trackFlag}
                    src={getTrackFlag(session.trackName)}
                  />
                  {session.trackName}
                </td>
                <td className={styles.td}>{session.sessionType}</td>
                {session.participants && <td className={styles.td}>{session.participants[0].firstName} {session.participants[0].lastName} ({session.participants[0].name}) #{session.participants[0].raceNumber}</td>}
                <td className={styles.td}>
                  <div className={styles.weatherInformation}>
                    <div className={styles.temperatureWrapper}>
                      <span
                        title={"Air temperature"}
                        className={styles.temperatureInfo}
                      >
                        <FaWind className={styles.temperatureIcon} />
                        {session.airTemperature}°
                      </span>
                      <span
                        title={"Track temperature"}
                        className={styles.temperatureInfo}
                      >
                        <FaRoad className={styles.temperatureIcon} />
                        {session.trackTemperature}°
                      </span>
                    </div>
                    <div className={styles.separator} />
                    {session.weather}
                  </div>
                </td>
                <td className={styles.td}>
                  {new Date(session.fileCreated).toLocaleString("en-GB")}
                </td>
                {/* <td className={styles.td}>{participantId}</td> */}
                {/* <td className={styles.td}>
                <div className={styles.syncStatus}>
                  {session.uploadedCount === session.totalParticipants ? (
                  <FiCloud />
                   ) : (
                    <div className={styles.progressBar}>
                      <div
                        className={styles.innerBar}
                        style={{
                          width: `${
                            (session.uploadedCount /
                              session.totalParticipants) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </td> */}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
