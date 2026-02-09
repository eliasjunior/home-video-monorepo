import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Footer from "./Footer";

describe("Footer", () => {
  it("renders navigation links", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
  });
});
