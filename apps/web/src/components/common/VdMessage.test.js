import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import VdMessage from "./VdMessage";

describe("VdMessage", () => {
  it("renders error message by default", () => {
    render(<VdMessage text="boom" />);
    expect(screen.getByText("boom")).toBeTruthy();
  });

  it("renders non-error message when error=false", () => {
    render(<VdMessage error={false} />);
    expect(screen.getByText("not ready")).toBeTruthy();
  });
});
