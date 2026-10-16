import { takeEvery, put, call } from "redux-saga/effects";
import { db, storage } from "../../firebase";
import { parseParquet } from "../parser";
import {
  fetchUserFailure,
  fetchUserSuccess,
  FETCH_USER_REQUEST,
  FETCH_TELEMETRY_REQUEST,
  loadRaceFile,
} from "./actions";

export function* raceSaga() {
  // yield fork(fetchUserRequest);
  yield takeEvery(FETCH_USER_REQUEST, handleFetchUser);
  // yield takeEvery(FETCH_SESSION_REQUEST, handleFetchSession);
  yield takeEvery(FETCH_TELEMETRY_REQUEST, handleFetchTelemetry);
}

function* handleFetchUser(action: any): Generator {
  try {
    const { userId } = action.payload;

    const userData: any = yield call(async () => {
      if (!db) return;
      const docRef = await db.collection("users").doc(userId);
      const doc = await docRef.get();
      return doc.data();
    });

    yield put(fetchUserSuccess(userData));
  } catch (error: any) {
    yield put(fetchUserFailure(error.message));
  }
}

// gets laps from session
// function* handleFetchSession(action: {
//   payload: { session: Session };
// }): Generator {
//   try {
//     const { session } = action.payload;

//     for (let lapId of session.lapIds) {
//       yield put(fetchLapRequest(lapId));
//     }

//     const laps: { [lapId: string]: Lap } = {};
//     for (let lapId of session.lapIds) {
//       const lap = yield call(async () => {
//         return await getLap(lapId);
//       })!;
//       laps[(lap as Lap).lapId] = lap as Lap;
//     }

//     yield put(fetchSessionSuccess({ ...sessionData, id: sessionID }));
//   } catch (error: any) {
//     yield put(fetchSessionFailure(error.message));
//   }
// }

function* handleFetchTelemetry(action: any): Generator {
  const { uniqueSessionId, userId, participantId } = action.payload;

  const raceData = yield call(async () => {
    return new Promise(async (resolve, reject) => {
      if (!storage) { reject(new Error("Cloud storage is not configured.")); return; }
      const gsReference = storage.ref(
        `telemetry/${userId}/${uniqueSessionId}-${participantId}.parquet`
      );
      // this works, just disabled. gets a parquet and parses it.
      const url = await gsReference.getDownloadURL();
      const xhr = new XMLHttpRequest();
      xhr.responseType = "blob";
      xhr.onload = async () => {
        const blob: Blob = xhr.response;
        const arrayBuffer: ArrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const records = await parseParquet(buffer);
        resolve(records);
      };
      xhr.open("GET", url);
      xhr.send();
    });
  });

  yield put(loadRaceFile(raceData));
}
