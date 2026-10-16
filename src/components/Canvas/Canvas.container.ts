import { connect } from "react-redux";
import { Canvas } from "./Canvas";
import { getLaps } from "../../modules/race/selectors";
import { RootState } from "../../modules/reducer";
import { fetchUserRequest } from "../../modules/race/actions";

const mapState = (state: RootState): any => {
  return {
    laps: getLaps(state),
  };
};

const mapDispatch = (dispatch: any): any => ({
  onLoadUser: (userId: string) => dispatch(fetchUserRequest(userId)),
});

export default connect(mapState, mapDispatch)(Canvas);
