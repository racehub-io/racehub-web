export interface User {
  displayName: string;
  email: string;
  emailVerified: boolean;
  sessionIds: string[];
}

export interface Lap {
  lapNumber?: number;
  lapTime?: number;
  rowCount?: number;
  sector1Time?: number;
  sector2Time?: number;
  sector3Time?: number;
  endTime: number;
  isComplete: boolean;
  isInLap: boolean;
  isOutLap: boolean;
  isValid: boolean;
  lapId: string;
  participantId: string;
  participant?: Participant;
  sessionId: string;
  startTime: number;
  uniqueSessionId: string;
}

export interface Participant {
  abbreviation: string;
  firstName: string;
  isAi: boolean;
  isPlayer: boolean;
  lapIds: string[];
  lastName: string;
  name: string;
  nationality: string;
  participantId: string;
  raceNumber: number;
  sessionId: number;
  storagePath: string;
  teamName: string;
  uniqueSessionId: string;
}

export interface Session {
  name?: string;
  simulator?: "f1" | "iracing" | "rfactor2";
  localLaps?: Lap[];
  airTemperature: number;
  fileCreated: Date;
  lapIds: string[];
  participantIds: string[];
  participants?: Participant[];
  rowCount: number;
  sessionId: number;
  sessionType: string;
  totalLaps: number;
  trackLength: number;
  trackName: string;
  trackTemperature: number;
  uniqueSessionId: string;
  userId: string;
  weather: string;
}
