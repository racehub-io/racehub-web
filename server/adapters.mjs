import {F1TelemetryClient, constants} from '@racehub-io/f1-telemetry-client';
import protobuf from 'protobufjs';
import {fileURLToPath} from 'node:url';

const own = (value, key) => Object.hasOwn(value ?? {}, key);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : undefined;
const clamp = (value, min, max) => finite(value) ? Math.min(max, Math.max(min, value)) : undefined;
const number = (value, key, scale = 1) => own(value, key) && finite(value[key]) ? value[key] * scale : undefined;
const clean = row => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined && (typeof value !== 'number' || finite(value))));
const tableName = (table, key) => text(table?.[key]?.name ?? table?.[key]?.long ?? table?.[key]);
const wheels = ['RL', 'RR', 'FL', 'FR'];

export function createF1Adapter() {
  let key;
  let packets = {};
  return buffer => {
    if (buffer.length < 21 || buffer.length > 65507) throw new Error('Invalid F1 packet length.');
    const format = buffer.readUInt16LE(0);
    if (format < 2018 || format > 2026) throw new Error('Unsupported F1 packet format.');
    const parsed = F1TelemetryClient.parseBufferMessage(buffer, true);
    if (!parsed?.packetData?.data?.m_header) throw new Error('Unsupported F1 packet type.');
    const data = parsed.packetData.data;
    const header = data.m_header;
    const expectedSize = F1TelemetryClient.getPacketSize(format, header.m_packetId);
    if (header.m_packetId !== 3 && finite(expectedSize) && buffer.length !== expectedSize) throw new Error('The F1 packet length does not match its format.');
    if (!finite(header.m_sessionTime) || header.m_sessionTime < 0) throw new Error('Invalid F1 session time.');
    const uid = String(header.m_sessionUID ?? '');
    if (!uid || uid === '0') return {rows: []};
    const nextKey = `${format}:${header.m_gameYear ?? format}:${uid}`;
    if (nextKey !== key) { key = nextKey; packets = {}; }
    packets[parsed.packetID] = data;
    if (parsed.packetID !== 'carTelemetry') return {rows: []};
    const session = packets.session ?? {};
    const participants = packets.participants?.m_participants;
    const count = packets.participants?.m_numActiveCars ?? packets.participants?.m_numCars;
    const player = header.m_playerCarIndex;
    const telemetry = data.m_carTelemetryData;
    if (!Array.isArray(telemetry)) throw new Error('Missing F1 car telemetry.');
    const indexes = Number.isInteger(count) && count > 0
      ? Array.from({length: Math.min(count, telemetry.length)}, (_, index) => index)
      : Number.isInteger(player) && player < telemetry.length ? [player] : [];
    const trackName = tableName(constants.TRACKS, session.m_trackId);
    const trackLength = number(session, 'm_trackLength');
    const rows = indexes.map(index => {
      const participant = participants?.[index];
      const visible = index === player || participant?.m_yourTelemetry !== 0;
      const car = visible ? telemetry[index] : {};
      const lap = packets.lapData?.m_lapData?.[index];
      const motion = packets.motion?.m_carMotionData?.[index];
      const status = visible ? packets.carStatus?.m_carStatusData?.[index] : undefined;
      const damage = visible ? packets.carDamage?.m_carDamageData?.[index] : undefined;
      const setup = visible ? packets.carSetups?.m_carSetups?.[index] : undefined;
      const driver = constants.DRIVERS?.[participant?.m_driverId];
      const driverName = text(participant?.m_name) ?? text([driver?.firstName, driver?.lastName].filter(Boolean).join(' '));
      const row = clean({
        participantId: `f1:${uid}:${index}`, sessionId: uid, carIndex: index,
        playerCarIndex: player, frameId: header.m_frameIdentifier,
        sessionTime: header.m_sessionTime, simulator: 'f1',
        participant_name: driverName, participant_team_name: tableName(format >= 2024 ? constants.TEAMS_2024 : constants.TEAMS, participant?.m_teamId),
        participant_first_name: text(driver?.firstName), participant_last_name: text(driver?.lastName),
        participant_abbreviation: text(driver?.abbreviation), participant_race_number: number(participant, 'm_raceNumber'),
        participant_isAI: number(participant, 'm_aiControlled'),
        track_name: trackName, track_length: trackLength,
        session_type: tableName(format >= 2024 ? constants.SESSION_TYPES_2024 : constants.SESSION_TYPES, session.m_sessionType),
        lap_number: number(lap, 'm_currentLapNum'), lap_distance: number(lap, 'm_lapDistance'),
        total_distance: number(lap, 'm_totalDistance'),
        lap_time: number(lap, 'm_currentLapTimeInMS') ?? number(lap, 'm_currentLapTime', 1000),
        last_lap_time: number(lap, 'm_lastLapTimeInMS') ?? number(lap, 'm_lastLapTime', 1000),
        sector_1_time: number(lap, 'm_sector1TimeInMS') === undefined ? number(lap, 'm_sector1Time', 1000) : lap.m_sector1TimeInMS + (number(lap, 'm_sector1TimeMinutes', 60000) ?? 0),
        sector_2_time: number(lap, 'm_sector2TimeInMS') === undefined ? number(lap, 'm_sector2Time', 1000) : lap.m_sector2TimeInMS + (number(lap, 'm_sector2TimeMinutes', 60000) ?? 0),
        lap_invalid: own(lap, 'm_currentLapInvalid') ? Boolean(lap.m_currentLapInvalid) : undefined,
        car_position: number(lap, 'm_carPosition'), sector: number(lap, 'm_sector'), pit_status: number(lap, 'm_pitStatus'),
        speed: number(car, 'm_speed'), gear: number(car, 'm_gear'), engine_rpm: number(car, 'm_engineRPM'),
        throttle: clamp(number(car, 'm_throttle', format === 2018 ? 0.01 : 1), 0, 1),
        brake: clamp(number(car, 'm_brake', format === 2018 ? 0.01 : 1), 0, 1),
        steer: clamp(number(car, 'm_steer', format === 2018 ? 0.01 : 1), -1, 1),
        clutch: number(car, 'm_clutch'), drs: number(car, 'm_drs'),
        world_x: number(motion, 'm_worldPositionX'), world_y: number(motion, 'm_worldPositionY'), world_z: number(motion, 'm_worldPositionZ'),
        g_lateral: number(motion, 'm_gForceLateral'), g_longitudinal: number(motion, 'm_gForceLongitudinal'), g_vertical: number(motion, 'm_gForceVertical'),
        yaw: number(motion, 'm_yaw'), pitch: number(motion, 'm_pitch'), roll: number(motion, 'm_roll'),
        fuel_in_tank: number(status, 'm_fuelInTank'), fuel_capacity: number(status, 'm_fuelCapacity'),
        tyre_compound: number(status, 'm_actualTyreCompound'), tyre_age: number(status, 'm_tyresAgeLaps'),
        ers_store_energy: number(status, 'm_ersStoreEnergy'), ers_deploy_mode: number(status, 'm_ersDeployMode'),
        track_temperature: number(session, 'm_trackTemperature'), air_temperature: number(session, 'm_airTemperature'),
        setup_front_wing: number(setup, 'm_frontWing'), setup_rear_wing: number(setup, 'm_rearWing'),
      });
      for (const [source, target] of [
        ['m_brakesTemperature', 'brake_temperature'], ['m_tyresSurfaceTemperature', 'tyre_surface_temperature'],
        ['m_tyresInnerTemperature', 'tyre_inner_temperature'], ['m_tyresPressure', 'tyre_pressure'],
      ]) car?.[source]?.forEach((value, wheel) => { if (finite(value) && wheels[wheel]) row[`${target}_${wheels[wheel]}`] = value; });
      for (const [source, target] of [['m_tyresWear', 'tyre_wear'], ['m_tyresDamage', 'tyre_damage'], ['m_brakesDamage', 'brake_damage']]) {
        damage?.[source]?.forEach((value, wheel) => { if (finite(value) && wheels[wheel]) row[`${target}_${wheels[wheel]}`] = value; });
      }
      return row;
    });
    return {rows, sessionKey: key, trackName, trackLength, playerParticipantId: indexes.includes(player) ? `f1:${uid}:${player}` : null};
  };
}

export async function createProtobufAdapters() {
  const iracingRoot = await protobuf.load(fileURLToPath(new URL('./protocols/iracing.proto', import.meta.url)));
  const rfactorRoot = await protobuf.load(fileURLToPath(new URL('./protocols/rfactor2.proto', import.meta.url)));
  const iracingType = iracingRoot.lookupType('TelemetryPacket');
  const rfactorType = rfactorRoot.lookupType('rFactor2UdpBroadcaster.DataPacket');
  let scoring;
  let generation = 0;
  let lastTrack;
  let lastTime;
  let lastSessionType;
  return {
    iracing(buffer) {
      if (!buffer.length || buffer.length > 65507) throw new Error('Invalid iRacing packet length.');
      const packet = iracingType.decode(buffer);
      const session = packet.SessionInfo;
      if (!session || !packet.Cars?.length || !packet.Participants?.length || !text(session.TrackName) || !finite(session.SessionTime)) {
        throw new Error('Expected the RaceHub iRacing UDP protocol.');
      }
      if (packet.Cars.length > 128 || packet.Participants.length > 128 || session.SessionTime < 0) throw new Error('Invalid iRacing participant count or session time.');
      const sessionId = String(session.SessionID);
      const trackLength = number(session, 'TrackLength');
      const participants = new Map(packet.Participants.map(person => [person.ParticipantIdx, person]));
      if (participants.size !== packet.Participants.length || new Set(packet.Cars.map(car => car.CarIdx)).size !== packet.Cars.length) throw new Error('Duplicate iRacing car slots.');
      const playerCars = packet.Cars.filter(car => ['RPM', 'Speed', 'Gear', 'Brake', 'Throttle', 'Clutch', 'LapTime'].some(field => own(car, field)));
      const playerIndex = playerCars.length === 1 ? playerCars[0].CarIdx : undefined;
      const rows = packet.Cars.map(car => {
        const carIndex = car.CarIdx;
        if (!Number.isInteger(carIndex) || carIndex < 0 || carIndex >= 128 || !participants.has(carIndex)) throw new Error('Invalid iRacing car slot.');
        const participant = participants.get(carIndex);
        const playerChannels = ['RPM', 'Speed', 'Gear', 'Brake', 'Throttle', 'Clutch', 'LapTime'].some(field => own(car, field));
        const value = field => playerChannels && finite(car[field]) ? car[field] : undefined;
        return clean({
          participantId: `iracing:${sessionId}:${carIndex}`, sessionId, carIndex, playerCarIndex: playerIndex,
          simulator: 'iracing', sessionTime: session.SessionTime,
          participant_name: text(participant?.DriverName), participant_team_name: text(participant?.TeamName),
          track_name: text(session.TrackName), track_length: trackLength,
          session_type: text(session.EventType), lap_number: own(car, 'Lap') ? car.Lap : undefined,
          lap_distance: own(car, 'LapDistancePct') && finite(trackLength) ? car.LapDistancePct * trackLength : undefined,
          lap_time: finite(value('LapTime')) ? value('LapTime') * 1000 : undefined,
          speed: finite(value('Speed')) ? value('Speed') * 3.6 : undefined,
          throttle: clamp(finite(value('Throttle')) ? value('Throttle') / 100 : undefined, 0, 1),
          brake: clamp(finite(value('Brake')) ? value('Brake') / 100 : undefined, 0, 1),
          clutch: clamp(finite(value('Clutch')) ? value('Clutch') / 100 : undefined, 0, 1), gear: value('Gear'), engine_rpm: value('RPM'),
          steer_angle: number(car, 'Steer'),
          air_temperature: number(session, 'AirTemperature'), track_temperature: number(session, 'TrackTemperature'),
        });
      });
      return {rows, sessionKey: `${sessionId}:${text(session.TrackName)}`, trackName: text(session.TrackName), trackLength,
        playerParticipantId: playerIndex === undefined ? null : `iracing:${sessionId}:${playerIndex}`};
    },
    rfactor2(buffer) {
      if (!buffer.length || buffer.length > 65507) throw new Error('Invalid rFactor 2 packet length.');
      const packet = rfactorType.decode(buffer);
      const header = packet.PacketHeader;
      if (!header || header.ContractVersion !== 1 || header.PacketType < 0 || header.PacketType > 3) throw new Error('Expected rFactor 2 contract version 1.');
      const bodyKey = ['Telemetry', 'Scoring', 'Graphics', 'Physics'][header.PacketType];
      if (!own(packet, bodyKey)) throw new Error('The rFactor 2 packet body does not match its header.');
      if (header.PacketType === 1) {
        const next = packet.Scoring;
        if (next.mVehicle?.length > 256) throw new Error('Invalid rFactor 2 participant count.');
        if (lastSessionType !== undefined && next.mSession !== lastSessionType) { generation++; lastTime = undefined; }
        lastSessionType = next.mSession;
        scoring = next;
        return {rows: []};
      }
      if (header.PacketType !== 0) return {rows: []};
      const car = packet.Telemetry;
      if (!finite(car.mElapsedTime) || car.mElapsedTime < 0 || !car.mLocalVel || !text(car.mTrackName)) throw new Error('Missing rFactor 2 telemetry fields.');
      const trackName = text(car.mTrackName);
      if ((lastTrack && lastTrack !== trackName) || (lastTime !== undefined && car.mElapsedTime < lastTime - 1)) { generation++; scoring = undefined; }
      lastTrack = trackName;
      lastTime = car.mElapsedTime;
      const sessionKey = `${trackName}:${generation}`;
      const index = car.mID;
      const score = scoring?.mVehicle?.find(vehicle => vehicle.mID === index);
      const player = scoring?.mVehicle?.find(vehicle => vehicle.mIsPlayer === true);
      const velocity = car.mLocalVel;
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z) * 3.6;
      const row = clean({
        participantId: `rfactor2:${sessionKey}:${index}`, sessionId: sessionKey, carIndex: index, playerCarIndex: player?.mID,
        simulator: 'rfactor2', sessionTime: car.mElapsedTime,
        participant_name: text(score?.mDriverName), track_name: trackName,
        track_length: scoring ? scoring.mLapDist : undefined,
        session_type: scoring && own(scoring, 'mSession') ? String(scoring.mSession) : undefined,
        lap_number: car.mLapNumber, lap_distance: score ? score.mLapDist : undefined,
        lap_time: finite(car.mLapStartET) ? Math.max(0, car.mElapsedTime - car.mLapStartET) * 1000 : undefined,
        last_lap_time: number(score, 'mLastLapTime', 1000),
        lap_invalid: own(score, 'mCountLapFlag') ? score.mCountLapFlag !== 2 : undefined,
        car_position: number(score, 'mPlace'), speed,
        throttle: clamp(car.mUnfilteredThrottle, 0, 1), brake: clamp(car.mUnfilteredBrake, 0, 1),
        steer: clamp(car.mUnfilteredSteering, -1, 1), clutch: number(car, 'mUnfilteredClutch'),
        gear: own(car, 'mGear') ? car.mGear | 0 : undefined, engine_rpm: number(car, 'mEngineRPM'),
        world_x: car.mPos?.x, world_y: car.mPos?.y, world_z: car.mPos?.z,
        fuel_in_tank: number(car, 'mFuel'), fuel_capacity: number(car, 'mFuelCapacity'),
        engine_temperature: number(car, 'mEngineWaterTemp'),
        air_temperature: number(scoring, 'mAmbientTemp'), track_temperature: number(scoring, 'mTrackTemp'),
      });
      car.mWheel?.forEach((wheel, i) => {
        const suffix = ['FL', 'FR', 'RL', 'RR'][i];
        if (!suffix) return;
        for (const [field, channel, scale, offset] of [
          ['mBrakeTemp', 'brake_temperature', 1, 0], ['mPressure', 'tyre_pressure', 0.1450377377, 0],
          ['mTireCarcassTemperature', 'tyre_inner_temperature', 1, -273.15],
        ]) if (own(wheel, field) && finite(wheel[field])) row[`${channel}_${suffix}`] = wheel[field] * scale + offset;
        if (wheel.mTemperature?.length && finite(wheel.mTemperature[1])) row[`tyre_surface_temperature_${suffix}`] = wheel.mTemperature[1] - 273.15;
      });
      return {rows: [row], sessionKey, trackName, trackLength: scoring?.mLapDist,
        playerParticipantId: player ? `rfactor2:${sessionKey}:${player.mID}` : null};
    },
  };
}

export async function createAdapters() {
  return {f1: createF1Adapter(), ...await createProtobufAdapters()};
}
