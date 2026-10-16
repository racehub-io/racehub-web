import { RootState } from "../reducer";

export const getRace = (state: RootState) => state.race;
export const getSession = (state: RootState) => state.race.session;
export const getParticipants = (state: RootState) =>
  state.race.session?.participants;
export const getLaps = (state: RootState) => state.race.session?.laps;
export const getSelectedLaps = (state: RootState) => state.race.laps;
