import { connect } from "react-redux";
import { RootState } from "../../../modules/reducer";
import { MapStateProps } from "./MapPanel.types";
import { MapPanel } from "./MapPanel";
import { getSelectedLaps } from "../../../modules/race/selectors";

const mapState = (state: RootState): MapStateProps => {
  return {
    laps: getSelectedLaps(state),
  };
};

export default connect(mapState)(MapPanel);
