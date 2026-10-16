import { IconType } from "react-icons";

export type Metadata = {
  [rhcFileName: string]: Sessions;
};

export type Sessions = {
  [sessionID: string]: Session;
};

export type Props = {
  title: string;
};

export type Session = {
  fileName: string;
  filePath: string;
  fileCreated: Date;
  fileModified: Date;
  trackName: string;
  trackLength: number;
  sessionType: string;
  totalLaps: number;
  trackTemperature: number;
  airTemperature: number;
  weather: string;
  rowCount: number;
  participants: Participants;
};

// export type RenderableSession = {
//   fileName: string;
//   filePath: string;
//   fileCreated: Date;
//   fileModified: Date;
//   sessionID: string;
//   trackFlag: string;
//   trackLength: number;
//   trackName: string;
//   sessionType: string;
//   totalLaps: number;
//   trackTemperature: number;
//   airTemperature: number;
//   weather: string;
//   rowCount: number;
//   weatherIcon: IconType;
//   uploadedCount: number;
//   totalParticipants: number;
// };

export type Participants = {
  [participantID: string]: Participant;
};

export type Participant = {
  uploaded: number;
};
