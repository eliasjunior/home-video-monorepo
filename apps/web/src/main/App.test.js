jest.mock("components/customHooks", () => ({
  useServerStatus: jest.fn(),
}));

jest.mock("./Routers", () => () => <div>ROUTERS</div>);

import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { useServerStatus } from "components/customHooks";

describe("App", () => {
  it("renders offline message when server is down", () => {
    useServerStatus.mockReturnValueOnce(false);
    render(<App />);

    expect(screen.getByText("server is unreachable")).toBeTruthy();
  });

  it("renders routes when server is online", () => {
    useServerStatus.mockReturnValueOnce(true);
    render(<App />);

    expect(screen.getByText("ROUTERS")).toBeTruthy();
  });
});
