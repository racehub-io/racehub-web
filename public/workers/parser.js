import { F1TelemetryClient } from "f1-telemetry-client";
const { getPacketSize, parseBufferMessage } = F1TelemetryClient;

function getPlayerTelemetry(parsedMessage, playerCarIndex) {
  const messagePacketData = parsedMessage.packetData.data;
  switch (parsedMessage.packetID) {
    case "lapData":
      return messagePacketData["m_lapData"][playerCarIndex];
    case "carStatus":
      return messagePacketData["m_carStatusData"][playerCarIndex];
    case "carTelemetry":
      return messagePacketData["m_carTelemetryData"][playerCarIndex];
    case "carSetups":
      return messagePacketData["m_carSetups"][playerCarIndex];
    case "motion":
      return messagePacketData["m_carMotionData"][playerCarIndex];
  }
}

export function parseRaceFile(buffer) {
  function readUInt16LE(buffer, offset) {
    return buffer[offset] | (buffer[offset + 1] << 8);
  }

  function readUInt8(buffer, offset) {
    return buffer[offset];
  }

  const laps = [];
  let currentLapNumber = 1,
    currentLapTime = 0,
    offset = 0,
    lastLapTime = 0,
    lapDistance = 0,
    initialTime = 0;

  let session = {};

  //while (offset < 40000000) {
  while (offset < buffer.length) {
    const m_packetFormat = readUInt16LE(buffer, offset);
    const m_packetId =
      m_packetFormat === 2018
        ? readUInt8(buffer, offset + 3)
        : readUInt8(buffer, offset + 5);
    const packetSize = getPacketSize(m_packetFormat, m_packetId);
    const parsedMessage = parseBufferMessage(
      buffer.slice(offset, offset + packetSize),
      false
    )!;
    offset += packetSize;

    const messagePacketData = parsedMessage.packetData!.data as any;
    const messageHeader = messagePacketData["m_header"];
    const absoluteSessionTimestamp = messageHeader["m_sessionTime"];
    const playerCarIndex = messageHeader["m_playerCarIndex"];

    if (parsedMessage.packetID === "session") {
      session = {
        trackId: messagePacketData["m_trackId"],
        sessionType: messagePacketData["m_sessionType"],
      };
    }

    if (parsedMessage.packetID === "lapData") {
      const playerLapData = messagePacketData["m_lapData"][playerCarIndex];
      currentLapNumber = playerLapData["m_currentLapNum"];
      currentLapTime = playerLapData["m_currentLapTime"];
      lastLapTime = playerLapData["m_lastLapTime"];
      lapDistance = playerLapData["m_lapDistance"];

      // applies lastLapTime to previous parsed lap
      if (1 < currentLapNumber) {
        laps[currentLapNumber - 2].lapTime = lastLapTime;
      }
    }

    if (!laps[currentLapNumber - 1]) {
      laps[currentLapNumber - 1] = {
        lapNumber: currentLapNumber,
        lapTime: 0,
        telemetry: {},
      };
    }

    if (currentLapTime > 0 && initialTime === 0) {
      initialTime = absoluteSessionTimestamp;
    }

    const playerTelemetry = getPlayerTelemetry(parsedMessage, playerCarIndex);

    // only save playerCarIndex information
    if (playerTelemetry) {
      // inits telemetry array
      if (!laps[currentLapNumber - 1].telemetry[parsedMessage.packetID]) {
        laps[currentLapNumber - 1].telemetry[parsedMessage.packetID] = [];
      }

      let timestamp = 0;
      if (initialTime > 0) {
        if (absoluteSessionTimestamp === initialTime) {
          timestamp = currentLapTime;
        } else {
          // allows pinpointing exact package time
          // (instead of using currentLapTime, which is anchored to lapData packages)
          timestamp = absoluteSessionTimestamp - initialTime;

          // takes out time of previous laps
          for (let i = 0; i < laps.length - 1; i++) {
            timestamp -= laps[i].lapTime;
          }
        }
      }

      laps[currentLapNumber - 1].telemetry[parsedMessage.packetID].push({
        ...playerTelemetry,
        messageType: parsedMessage.packetID,
        absoluteSessionTimestamp,
        timestamp,
        lastLapTime,
        lapDistance,
      });

      laps[currentLapNumber - 1].lapTime = timestamp;
    }
  }

  return { laps, session };
}
