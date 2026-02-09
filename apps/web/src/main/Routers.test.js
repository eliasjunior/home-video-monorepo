jest.mock("components/video/components/VideoMainList", () => () => (
  <div>VIDEO_MAIN_LIST</div>
));
jest.mock("components/video/components/Player", () => () => <div>PLAYER</div>);
jest.mock("components/auth/Login", () => () => <div>LOGIN</div>);

import React from "react";
import { render, screen } from "@testing-library/react";
import Routers from "./Routers";

describe("Routers", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("renders login route", () => {
    window.history.pushState({}, "", "/login");
    render(<Routers dispatch={jest.fn()} />);
    expect(screen.getByText("LOGIN")).toBeTruthy();
  });

  it("renders player route", () => {
    window.history.pushState({}, "", "/display/1/videos");
    render(<Routers dispatch={jest.fn()} />);
    expect(screen.getByText("PLAYER")).toBeTruthy();
  });

  it("renders main list for root", () => {
    window.history.pushState({}, "", "/");
    render(<Routers dispatch={jest.fn()} />);
    expect(screen.getByText("VIDEO_MAIN_LIST")).toBeTruthy();
  });

  it("renders main list for unknown path", () => {
    window.history.pushState({}, "", "/unknown");
    render(<Routers dispatch={jest.fn()} />);
    expect(screen.getByText("VIDEO_MAIN_LIST")).toBeTruthy();
  });
});
