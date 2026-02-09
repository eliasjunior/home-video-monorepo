import Poster from "./Poster";
import React from "react";
import "@testing-library/jest-dom/extend-expect";
import { createRoot } from "react-dom/client";
import { screen, render } from "@testing-library/react";

describe("Poster", () => {
  test("loads movie poster", () => {
    const root = createRoot(document.createElement("div"));

    render(
      <Poster
        video={{ name: "", id: "fantasy" }}
        onSetVideo={() => console.log("set")}
        isSeries={false}
      ></Poster>
    );
    // Act
    const imgContainer = screen.getByAltText(/poster/);
    // Assert
    expect(imgContainer).not.toBeNull();
    expect(imgContainer).toHaveAttribute("alt", "Movie poster");
  });
  test("loads show poster", () => {
    // Arrange
    render(
      <Poster
        video={{ name: "", id: "breaking good" }}
        isSeries={true}
      ></Poster>
    );
    // Act
    const imgContainer = screen.getByAltText(/poster/);

    expect(imgContainer).not.toBeNull();
    expect(imgContainer).toHaveAttribute("alt", "Series poster");
    // Assert
  });
});
