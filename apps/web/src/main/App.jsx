import VdMessage from "components/common/VdMessage";
import { useServerStatus } from "components/customHooks";
import React, { useReducer } from "react";
import "./App.css";
import { initialState, reducer } from "./Reducer";
import Routers from "./Routers";

function App() {
  const isOnline = useServerStatus();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { hasError, message } = state;
  const displayContent = () => {
    if (!isOnline) {
      return <VdMessage text="server is unreachable"></VdMessage>;
    } else {
      if (hasError) {
        return <VdMessage text={message}></VdMessage>;
      }
      return <Routers dispatch={dispatch}></Routers>;
    }
  };
  return <div className="app">{displayContent()}</div>;
}
export default App;
