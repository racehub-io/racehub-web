import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/storage";
import "firebase/auth";
import { sendToRaceHubClient } from "./Root";
import { User, Session, Participant, Lap } from "./types";

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const USERS = "users";
const SESSIONS = "sessions";
const PARTICIPANTS = "participants";
const LAPS = "laps";

export const firebaseApp = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
  ? firebase.initializeApp(firebaseConfig)
  : undefined;
export const db = firebaseApp?.firestore();
export const storage = firebaseApp?.storage();
if (firebaseApp) addNewTokenListener();

function addNewTokenListener() {
  firebase.auth().onIdTokenChanged(async (user) => {
    // User is signed in or token was refreshed.
    const uid = user?.uid;
    const token = await user?.getIdToken();

    if (!uid || !token) {
      return;
    }

    const intervalHandle = setInterval(() => {
      const sendSuccessful = sendToRaceHubClient({
        action: "FIREBASE_INFO",
        payload: { uid, token },
      });
      // if (sendSuccessful) clearInterval(intervalHandle);
    }, 3e3);
  });
}

const getElement = async <T>(
  collection: string,
  id: string
): Promise<T | undefined> => {
  if (!db || !firebase.auth().currentUser) return;
  try {
    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`${collection}/${id} doesn't exist`);
    }

    return doc.data() as T;
  } catch (error) {
    console.error(error);
  }
};

export const getSession = async (
  sessionId: string
): Promise<Session | undefined> => {
  return getElement<Session>(SESSIONS, sessionId);
};

export const getLap = async (lapId: string): Promise<Lap | undefined> => {
  return getElement<Lap>(LAPS, lapId);
};

export const getParticipant = async (
  participantId: string
): Promise<Participant | undefined> => {
  return getElement<Participant>(PARTICIPANTS, participantId);
};

export const getUser = async (): Promise<User | undefined> => {
  if (!firebaseApp) return;
  const auth = firebase.auth();
  const userId = auth?.currentUser?.uid;
  return getUserById(userId);
};

export const getUserById = async (userId?: string): Promise<User | undefined> => {
  if (userId) {
    return getElement<User>(USERS, userId);
  }
};

export const writeParquetMeta = async (metadata: any) => {
  if (!db || !firebase.auth().currentUser) return;
  const firestore = db;
  const uniqueSessionId = metadata.session.uniqueSessionId;

  const sessionRef = db.collection(SESSIONS).doc(uniqueSessionId);

  const sessionMetadata = { ...metadata.session, participantIds: [], lapIds: [] };

  sessionRef.get()
    .then((docSnapshot) => {
      if (!docSnapshot.exists) {
        sessionRef.set(sessionMetadata)
      }
    });

  const participantId = metadata.participant.participantId;

  const laps = metadata.laps;

  const lapIds = laps.map((lap: any) => lap.lapId);

  const participantMetadata = { ...metadata.participant, lapIds }

  const res = await db.collection(PARTICIPANTS).doc(participantId).set(participantMetadata);

  metadata.laps.forEach(async (lap: any) => {
    const lapId = lap.lapId;
    const res = await firestore.collection(LAPS).doc(lapId).set(lap);
  })

  const unionRes = await sessionRef.update({
    participantIds: firebase.firestore.FieldValue.arrayUnion(participantId),
    lapIds: firebase.firestore.FieldValue.arrayUnion(...lapIds),
  });

  const auth = firebase.auth();
  const userId = auth?.currentUser?.uid;

  if (userId) {
    const userRef = db.collection(USERS).doc(userId);

    const unionRes = await userRef.update({
      sessionIds: firebase.firestore.FieldValue.arrayUnion(uniqueSessionId),
    });
  }
};

export { firebase };
