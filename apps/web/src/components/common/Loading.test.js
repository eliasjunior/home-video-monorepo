import { render } from "@testing-library/react";
import Loading from "./Loading";

describe("Loading", () => {
  it("renders loading container", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector(".loading")).toBeTruthy();
    expect(container.querySelector(".loading--symbol")).toBeTruthy();
  });
});
