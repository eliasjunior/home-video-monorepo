import React from "react";
import PropTypes from "prop-types";
import { Route, Switch, BrowserRouter } from "react-router-dom";
import "./App.css";
import VideoMainList from "components/video/components/VideoMainList";
import Player from "components/video/components/Player";
import Login from "components/auth/Login";

export default function Routers({ dispatch }) {
  return (
    <BrowserRouter basename={process.env.PUBLIC_URL || '/home-video'}>
      <Switch>
        <Route
          exact
          path={`/login`}
          render={() => <Login></Login>}
        ></Route>
        <Route
          exact
          path={`/`}
          render={(props) => {
            return <VideoMainList {...props} dispatch={dispatch}></VideoMainList>;
          }}
        ></Route>
        <Route
          path={`/display/:id/:type`}
          render={(props) => <Player {...props} dispatch={dispatch}></Player>}
        ></Route>
        <Route
          path={`/settings`}
          render={() => (
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "white",
              }}
            >
              IN CONSTRUCTION
            </div>
          )}
        ></Route>
        <Route
          // need to be after /display because is dynamic
          path={`/:path`}
          render={(props) => {
            return (
              <VideoMainList {...props} dispatch={dispatch}></VideoMainList>
            );
          }}
        ></Route>
      </Switch>
    </BrowserRouter>
  );
}

Routers.propTypes = {
  dispatch: PropTypes.func.isRequired,
};
