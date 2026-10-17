import React, { Suspense, lazy } from "react";
import { BrowserRouter, HashRouter, Link, Route, Switch } from "react-router-dom";
import { Home } from "./components/Home";
import { browserOnly } from "./runtime";

const Canvas = lazy(() => import("./components/Canvas").then(({ Canvas }) => ({ default: Canvas })));

export default function Root() {
  const Router: React.ComponentType<{ children?: React.ReactNode }> = browserOnly ? HashRouter : BrowserRouter;
  return (
    <Router>
      <Suspense fallback={<p role="status">Loading analysis tools...</p>}>
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/analyser" component={Canvas} />
          <Route><p>Page not found. <Link to="/analyser">Open the analyser.</Link></p></Route>
        </Switch>
      </Suspense>
    </Router>
  );
}
