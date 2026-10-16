import React, { useEffect, useState } from "react";
import classnames from "classnames";
import { FiSave, FiX } from "react-icons/fi";
import { ActionButton } from "../../Common/ActionButton";
import { useStore } from "../../../modules/context";
import { Streamgraph } from "../../Common/Streamgraph";
import { nFormatter, isIPAddressValid } from "./helpers";
import { timeFormat } from 'd3-time-format';

import styles from "./Recorder.module.scss";
import { Props } from "./Recorder.types";
import { sendToRaceHubClient } from "../../../Root";

const format = timeFormat("%H:%M:%S.%L");

function getWSConnected(state: number) {
  return state === WebSocket.OPEN;
}

export function Recorder(props: Props) {
  const { store } = useStore();
  const { isParsing, recorderInfo } = store;
  const [inPort, setInPort] = useState(30501);
  const [outAddress, setOutAddress] = useState("127.0.0.1");
  const [outPort, setOutPort] = useState(30500);
  const [isForwardingEnabled, setIsForwardingEnabled] = useState(false);
  const [isRecorderConnected, setIsRecorderConnected] = useState(false);

  // useEffect(() => {
  //   ipcRenderer.onRecordedMessage((message: any) => {
  //     setMessageCount(message.messageCount);
  //     setLastMessageTime(Date.now() - message.lastMessage);
  //   });

  //   ipcRenderer.onParserEnded(() => {
  //     dispatch({ type: END_PARSING });
  //   });
  // }, []);

  useEffect(() => {
    if (!getWSConnected(store.wsStatus)) {
      setIsRecorderConnected(false);
    }
  }, [store.wsStatus]);

  const isWSConnected = getWSConnected(store.wsStatus);
  const isConnected = isWSConnected && isRecorderConnected;

  const { lastMessage, messageCount, sessionType, track } = recorderInfo;

  const handleToggleRecording = () => {
    setIsRecorderConnected((prevConnected) => {
      // toggles the recorder, updates the value of isConnected
      if (prevConnected) {
        sendToRaceHubClient({
          action: "STOP_RECORDING",
        });
      } else {
        sendToRaceHubClient({
          action: "START_RECORDING",
          payload: { inPort, outAddress, outPort, isForwardingEnabled },
        });
      }
      return !prevConnected;
    });
  };

  return (
    <div className={styles.recorderWrapper}>
      <div className={styles.form}>
        <div className={styles.udpForm}>
          <div className={styles.labelWrapper}>
            <span>UDP In Port</span>
          </div>
          <input
            className={styles.input}
            type="text"
            value={inPort}
            onChange={(e) =>
              e.target.value.length === 0
                ? setInPort(0)
                : setInPort(parseInt(e.target.value, 10))
            }
            disabled={isConnected}
          />

          <div className={styles.forwardingSection}>
            <div className={styles.addressSection}>
              <div className={styles.labelWrapper}>
                <span>UDP Forward Address</span>
                {!isConnected && (
                  <div
                    className={classnames(styles.toggleButton, {
                      [styles.toggleButtonDisabled]: isConnected,
                    })}
                    onClick={() => {
                      if (isConnected) {
                        return;
                      }
                      setIsForwardingEnabled(
                        (previsForwardingEnabled) => !previsForwardingEnabled
                      );
                    }}
                  >
                    {isForwardingEnabled ? "Disable" : "Enable"}
                  </div>
                )}
              </div>
              <input
                disabled={!isForwardingEnabled || isConnected}
                className={styles.input}
                type="text"
                onChange={(e) => setOutAddress(e.target.value)}
                value={!isForwardingEnabled ? "-" : outAddress}
              />
            </div>

            <div className={styles.portSection}>
              <div className={styles.labelWrapper}>
                <span>Port</span>
              </div>
              <input
                disabled={!isForwardingEnabled || isConnected}
                className={styles.input}
                type="text"
                onChange={(e) =>
                  e.target.value.length === 0
                    ? setOutPort(0)
                    : setOutPort(parseInt(e.target.value, 10))
                }
                value={!isForwardingEnabled ? "-" : outPort}
              />
            </div>
          </div>
          {isForwardingEnabled && !isIPAddressValid(outAddress) ? (
            <div className={styles.errorMessage}>{"Invalid IP Address"}</div>
          ) : null}
        </div>
        <div className={styles.buttons}>
          <ActionButton
            className={styles.button}
            disabled={
              (isForwardingEnabled && !isIPAddressValid(outAddress)) ||
              isParsing || !isWSConnected
            }
            icon={
              isConnected ? (
                <FiX className={styles.icon} />
              ) : (
                <FiSave className={styles.icon} />
              )
            }
            label={
              isConnected
                ? "Disconnect" : "Record"
            }
            onClick={handleToggleRecording}
          />
        </div>
      </div>
      <div className={styles.graphWrapper}>
        <div className={styles.graph}>
          {isConnected && (
            <>
            <span className={styles.packetsMetric}>{track} {sessionType} PACKETS: {nFormatter(messageCount)} LAST MESSAGE: {format(lastMessage)}</span>
            </>
          )}
          {/* TODO: have the possibility of showing a less CPU-intensive visualisation */}
          <Streamgraph
            width={550}
            height={200}
            multiplier={1}
            animate={isConnected}
          />
        </div>
      </div>
    </div>
  );
}
