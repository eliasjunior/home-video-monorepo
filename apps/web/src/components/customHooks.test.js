jest.mock("common/Util", () => ({
  subscribeServerStatus: jest.fn(),
}));

import React from "react";
import { render, screen } from "@testing-library/react";
import { subscribeServerStatus } from "common/Util";
import { useServerStatus } from "./customHooks";

function StatusView() {
  const online = useServerStatus();
  return <div>{online ? "online" : "offline"}</div>;
}

describe("useServerStatus", () => {
  it("sets online when subscribe returns true", () => {
    subscribeServerStatus.mockImplementationOnce(({ onHandleStatus }) => {
      onHandleStatus(true);
    });

    render(<StatusView />);

    expect(screen.getByText("online")).toBeTruthy();
  });

  it("stays offline when subscribe returns false", () => {
    subscribeServerStatus.mockImplementationOnce(({ onHandleStatus }) => {
      onHandleStatus(false);
    });

    render(<StatusView />);

    expect(screen.getByText("offline")).toBeTruthy();
  });
});
