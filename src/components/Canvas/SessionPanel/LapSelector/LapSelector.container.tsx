import { connect } from "react-redux";
import { fetchTelemetryRequest } from "../../../../modules/race/actions";
import { LapSelector } from "./LapSelector";
import { MapDispatchProps } from "./LapSelector.types";

const mapDispatch = (dispatch: any): MapDispatchProps => ({
  onLapSelection: (sessionId: string, userId: string, participantId: string) =>
    dispatch(fetchTelemetryRequest(sessionId, userId, participantId)),
});

export default connect(undefined, mapDispatch)(LapSelector);
