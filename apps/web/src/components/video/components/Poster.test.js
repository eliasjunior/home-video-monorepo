jest.mock("config", () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      SERVER_URL: "http://example.test:8080",
    })),
  };
});

jest.mock("./Presenter", () => ({
  getMovieImgPath: jest.fn(),
}));

jest.mock("services/Api", () => ({
  getBlobUrl: jest.fn(),
}));

import Poster from "./Poster";
import React from "react";
import { screen, render, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { getMovieImgPath } from "./Presenter";
import { getBlobUrl } from "services/Api";
import config from "config";

describe("Poster", () => {
  beforeEach(() => {
    config.mockReturnValue({ SERVER_URL: "http://example.test:8080" });
    getMovieImgPath.mockReset();
    getBlobUrl.mockReset();
    URL.revokeObjectURL = jest.fn();
  });

  test("loads movie poster when url is absolute", () => {
    getMovieImgPath.mockReturnValueOnce("http://img.test/x.png");
    render(
      <Poster
        video={{ name: "", id: "fantasy" }}
        onSetVideo={() => console.log("set")}
        isSeries={false}
      ></Poster>
    );
    const imgContainer = screen.getByAltText(/poster/);
    expect(imgContainer).not.toBeNull();
    expect(imgContainer.getAttribute("alt")).toBe("Movie poster");
    expect(imgContainer.getAttribute("src")).toBe("http://img.test/x.png");
  });

  test("loads show poster", () => {
    getMovieImgPath.mockReturnValueOnce("http://img.test/x.png");
    render(
      <Poster
        video={{ name: "", id: "breaking good" }}
        isSeries={true}
      ></Poster>
    );
    const imgContainer = screen.getByAltText(/poster/);

    expect(imgContainer).not.toBeNull();
    expect(imgContainer.getAttribute("alt")).toBe("Series poster");
  });

  test("uses server url when path is in public", async () => {
    getMovieImgPath.mockReturnValueOnce("public/img.png");
    render(
      <Poster
        video={{ name: "", id: "fantasy" }}
        onSetVideo={() => {}}
        isSeries={false}
      ></Poster>
    );

    await waitFor(() => {
      expect(screen.getByAltText(/poster/).getAttribute("src")).toBe(
        "http://example.test:8080/public/img.png"
      );
    });
  });

  test("uses blob url when fetched", async () => {
    getMovieImgPath.mockReturnValueOnce("images/fantasy");
    getBlobUrl.mockResolvedValueOnce("blob://x");
    render(
      <Poster
        video={{ name: "", id: "fantasy" }}
        onSetVideo={() => {}}
        isSeries={false}
      ></Poster>
    );

    await waitFor(() => {
      expect(screen.getByAltText(/poster/).getAttribute("src")).toBe("blob://x");
    });
  });

  test("falls back to default image on error", async () => {
    getMovieImgPath.mockReturnValueOnce("images/fantasy");
    getBlobUrl.mockRejectedValueOnce(new Error("fail"));
    render(
      <Poster
        video={{ name: "", id: "fantasy" }}
        onSetVideo={() => {}}
        isSeries={false}
      ></Poster>
    );

    await waitFor(() => {
      expect(screen.getByAltText(/poster/).getAttribute("src")).toBe(
        "http://example.test:8080/public/movie_fallback.png"
      );
    });
  });

  test("shows dialog list when series is clicked", () => {
    getMovieImgPath.mockReturnValueOnce("http://img.test/x.png");
    render(
      <Poster
        video={{ name: "Series", id: "s1", fileIds: ["ep1"] }}
        onSetVideo={() => {}}
        isSeries={true}
      ></Poster>
    );

    const box = document.querySelector(".media-box");
    fireEvent.click(box);

    expect(screen.getByText("ep1")).toBeTruthy();
  });
});
