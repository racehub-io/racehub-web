import firebase from "firebase";
import React, { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import { hot } from "react-hot-loader/root";
import { History } from "history";

import { Home } from "./components/Home";

import { firebaseApp, writeParquetMeta } from "./firebase";
import { LOAD_USER, RECORDER_STATUS, WRITE_PARQUET_META, WS_NEW_STATUS } from "./modules/race/actions";
import { useDispatch } from "./modules/context";

const Canvas = lazy(() =>
  import("./components/Canvas").then(({ Canvas }) => ({
    default: Canvas,
  }))
);

type Props = {
  history: History;
  onLoadUser: (user: any) => void;
};

export type MapDispatchProps = Pick<Props, "onLoadUser">;

const URL: string = 'ws://localhost:8081';

function reconnectingSocket(url: string) {
  let client: WebSocket;
  let isConnected = false;
  let reconnectOnClose = true;
  let messageListeners: Function[] = [];
  let stateChangeListeners: Function[] = [];

  function on(fn: Function) {
    messageListeners.push(fn);
  }

  function off(fn: Function) {
    messageListeners = messageListeners.filter(l => l !== fn);
  }

  function onStateChange(fn: Function) {
    stateChangeListeners.push(fn);
    return () => {
      stateChangeListeners = stateChangeListeners.filter(l => l !== fn);
    };
  }

  function start() {
    client = new WebSocket(URL);

    client.onopen = () => {
      isConnected = true;
      stateChangeListeners.forEach(fn => fn(true));
    }

    const close = client.close;

    // Close without reconnecting;
    client.close = () => {
      reconnectOnClose = false;
      close.call(client);
    }

    client.onmessage = (event) => {
      messageListeners.forEach(fn => fn(event.data));
    }

    client.onerror = (e) => console.error(e);

    client.onclose = () => {

      isConnected = false;
      stateChangeListeners.forEach(fn => fn(false));

      if (!reconnectOnClose) {
        console.log('ws closed by app');
        return;
      }

      console.log('ws closed by server');

      setTimeout(start, 3e3);
    }
  }

  start();

  return {
    on,
    off,
    onStateChange,
    close: () => client.close(),
    getClient: () => client,
    isConnected: () => isConnected,
  };
}

const client = reconnectingSocket(URL);

function useMessages() {
  const { dispatch } = useDispatch();
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    function handleMessage(message: string) {
      const parsedMessage = JSON.parse(message);
      const { action, payload } = parsedMessage;
      switch (action) {
        case WRITE_PARQUET_META:
          // firebase write meta
          writeParquetMeta(payload);
          break;
        case RECORDER_STATUS:
          dispatch({ type: RECORDER_STATUS, payload });
          break;
        default:
          break;
      }
      setMessages([...messages, parsedMessage]);
    }
    client.on(handleMessage);
    return () => client.off(handleMessage);
  }, [messages, setMessages]);

  return messages;
}

export function sendToRaceHubClient(value: any) {
  if (client.isConnected()) {
    client.getClient().send(JSON.stringify(value));
    return true;
  } else {
    console.log("Send to WS failed - ws.readyState ", client.isConnected());
  }
  return false;
}

const Root = () => {
  const { dispatch } = useDispatch();

  const messages = useMessages();
  const [isConnected, setIsConnected] = useState(client.isConnected());
  
  useEffect(() => {
    if (!firebaseApp) return;
    const unregisterAuthObserver = firebase
      .auth()
      .onAuthStateChanged((user) => {
        dispatch({ type: LOAD_USER, user });
      });

    return () => unregisterAuthObserver();
  }, []);

  useEffect(() => {
    return client.onStateChange(setIsConnected);
  }, [setIsConnected]);

  useEffect(() => {
    switch (isConnected) {
      case true:
        dispatch({ type: WS_NEW_STATUS, wsStatus: WebSocket.OPEN });
        return;
      default:
        dispatch({ type: WS_NEW_STATUS, wsStatus: WebSocket.CLOSED });
        return;
    }
  }, [isConnected]);

  return (
    <Router>
      <Suspense fallback={<div>Loading Canvas...</div>}>
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/analyser" component={Canvas} />
        </Switch>
      </Suspense>
    </Router>
  );
};

export default hot(Root);
