import { connect } from "react-redux";
import { RootState } from "../../../modules/reducer";
import { SessionPanel } from "./SessionPanel";
import {
  getLaps,
  getParticipants,
  getSession,
} from "../../../modules/race/selectors";

const mapState = (state: RootState): any => ({
  session: getSession(state),
  participants: getParticipants(state),
  laps: getLaps(state),
});

export default connect(mapState, {})(SessionPanel);
