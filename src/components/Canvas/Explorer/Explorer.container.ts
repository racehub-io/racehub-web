import { connect } from "react-redux";
import { loadRaceFile, resetRaceFile } from "../../../modules/race/actions";
import { Explorer } from "./Explorer";

export default connect(null, { onLoadRows: loadRaceFile, onClear: resetRaceFile })(Explorer);
