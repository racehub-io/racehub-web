import { connect } from "react-redux";
import { RootState } from "../../../modules/reducer";
import { MapStateProps } from "./TyresSurfaceTemperaturePanel.types";
import { TyresSurfaceTemperaturePanel } from "./TyresSurfaceTemperaturePanel";

const mapStateToProps = (state: RootState): MapStateProps => {
  return {
    tyresSurfaceTemperature: {},
  };
};

export default connect(mapStateToProps, {})(TyresSurfaceTemperaturePanel);
