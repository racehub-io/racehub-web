import { connect } from "react-redux";
import { fetchTelemetryRequest } from "../../../modules/race/actions";
import { getParticipants } from "../../../modules/race/selectors";
import { Explorer } from "./Explorer";

const mapState = (state: any, ownProps: any) => {
  return {
    ...ownProps,
    participants: getParticipants(state),
  };
};

const mapDispatch = (dispatch: any): any => ({
  onLoadSession: (
    uniqueSessionId: string,
    userId: string,
    participantId: string
  ) => dispatch(fetchTelemetryRequest(uniqueSessionId, userId, participantId)),
});

export default connect(mapState, mapDispatch)(Explorer);
