import { Participant } from "../../components/Canvas/Explorer/Explorer.types";
import {
  FetchUserSuccess,
  FetchSessionSuccess,
  FetchLapSuccess,
  LoadRaceFile,
  ResetRaceFile,
} from "./actions";

export type RaceState = {
  session: Session | undefined;
  participants: string[];
  laps: TelemetryData[];
};

export type Session = {
  sessionType: string;
  trackName: string;
  trackTemperature: number;
  airTemperature: number;
  weather: number;
  trackId: number;
  participants: any[];
  laps: any[];
};

export type LapTimes = {
  [lapNumber: number]: number;
};

export type TelemetryData = {
  ai_difficulty: number;
  air_temperate: number;
  anti_lock_brakes: number;
  brake: number;
  brake_damage_FL: number;
  brake_damage_FR: number;
  brake_damage_RL: number;
  brake_damage_RR: number;
  brake_temperature_FL: number;
  brake_temperature_FR: number;
  brake_temperature_RL: number;
  brake_temperature_RR: number;
  braking_assist: number;
  calculated_lap_number: number;
  carIndex: number;
  car_position: number;
  clutch: number;
  diffuser_damage: number;
  driver_status: number;
  drs: number;
  drs_allowed: number;
  drs_assist: number;
  drs_fault: number;
  engine_CE_wear: number;
  engine_ES_wear: number;
  engine_ICE_wear: number;
  engine_MGUH_wear: number;
  engine_MGUK_wear: number;
  engine_TC_wear: number;
  engine_damage: number;
  engine_rpm: number;
  engine_temperature: number;
  ers_assist: number;
  ers_deploy_mode: number;
  ers_deployed_lap: number;
  ers_harvested_lap_MGUH: number;
  ers_harvested_lap_MGUK: number;
  ers_store_energy: number;
  floor_damage: number;
  formula: string;
  frameID: number;
  front_brake_bias: number;
  front_wing_damage_left: number;
  front_wing_damage_right: number;
  fuel_in_tank: number;
  fuel_mix: number;
  g_lateral: number;
  g_longitudinal: number;
  g_vertical: number;
  gear: number;
  gearbox_assist: number;
  gearbox_damage: number;
  grid_position: number;
  lap_distance: number;
  lap_invalid: number;
  lap_number: number;
  lap_time: number;
  last_lap_time?: number;
  marshalling_flags: number;
  participant_abbreviation: string;
  participant_first_name: string;
  participant_isAI: number;
  participant_last_name: string;
  participant_name: string;
  participant_nationality: string;
  participant_network_ID: number;
  participant_race_number: number;
  participant_team_name: string;
  participant_udp_visibility: number;
  penalties: number;
  pit_assist: number;
  pit_limiter_status: number;
  pit_release_assist: number;
  pit_status: number;
  pitch: number;
  pitstop_rejoin_position: number;
  playerCarIndex: number;
  racing_line: number;
  racing_line_type: number;
  rear_wing_damage: number;
  result_status: number;
  roll: number;
  safety_car_delta: number;
  safety_car_status: number;
  sector: number;
  sector_1_time: number;
  sector_2_time: number;
  sessionID: string;
  sessionTime: number;
  session_time_remaining: number;
  session_type: string;
  setup_ballast: number;
  setup_brake_bias: number;
  setup_brake_pressure: number;
  setup_diff_off_throttle: number;
  setup_diff_on_throttle: number;
  setup_front_anti_roll_bar: number;
  setup_front_camber: number;
  setup_front_suspension: number;
  setup_front_suspension_height: number;
  setup_front_toe: number;
  setup_front_wing: number;
  setup_fuel_load: number;
  setup_rear_anti_roll_bar: number;
  setup_rear_camber: number;
  setup_rear_suspension: number;
  setup_rear_suspension_height: number;
  setup_rear_toe: number;
  setup_rear_wing: number;
  setup_tyre_pressure_FL: number;
  setup_tyre_pressure_FR: number;
  setup_tyre_pressure_RL: number;
  setup_tyre_pressure_RR: number;
  sidepod_damage: number;
  speed: number;
  steer: number;
  steering_assist: number;
  throttle: number;
  total_distance: number;
  total_laps: number;
  track_length: number;
  track_name: string;
  track_temperature: number;
  traction_control: number;
  tyre_age: number;
  tyre_compound: number;
  tyre_damage_FL: number;
  tyre_damage_FR: number;
  tyre_damage_RL: number;
  tyre_damage_RR: number;
  tyre_inner_temperature_FL: number;
  tyre_inner_temperature_FR: number;
  tyre_inner_temperature_RL: number;
  tyre_inner_temperature_RR: number;
  tyre_pressure_FL: number;
  tyre_pressure_FR: number;
  tyre_pressure_RL: number;
  tyre_pressure_RR: number;
  tyre_surface_temperature_FL: number;
  tyre_surface_temperature_FR: number;
  tyre_surface_temperature_RL: number;
  tyre_surface_temperature_RR: number;
  tyre_visual_compound: number;
  tyre_wear_FL: number;
  tyre_wear_FR: number;
  tyre_wear_RL: number;
  tyre_wear_RR: number;
  uniqueSessionID: string;
  warnings: number;
  weather: number;
  wheel_slip_FL: number;
  wheel_slip_FR: number;
  wheel_slip_RL: number;
  wheel_slip_RR: number;
  wheel_speed_FL: number;
  wheel_speed_FR: number;
  wheel_speed_RL: number;
  wheel_speed_RR: number;
  world_x: number;
  world_y: number;
  world_z: number;
};

export type RaceReducerAction =
  | FetchUserSuccess
  | FetchSessionSuccess
  | FetchLapSuccess
  | LoadRaceFile
  | ResetRaceFile;
