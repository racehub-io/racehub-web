import { connect } from "react-redux";
import { RootState } from "../../../modules/reducer";
import { MapStateProps } from "./LineChartPanel.types";
import { LineChartPanel } from "./LineChartPanel";
import { getSelectedLaps } from "../../../modules/race/selectors";

const mapState = (state: RootState): MapStateProps => {
  return {
    laps: getSelectedLaps(state),
  };
};

export default connect(mapState)(LineChartPanel);
