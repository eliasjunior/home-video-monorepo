jest.mock("services/auth", () => ({
  logout: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import Header from "./Header";
import { logout } from "services/auth";
import { MOVIE_CATEG, SERIES_CATEG } from "common/constants";

describe("Header", () => {
  it("toggles search input and filters category", async () => {
    const onChangeSearch = jest.fn();
    const onFilterCat = jest.fn();
    const history = { push: jest.fn() };

    render(
      <Header
        onChangeSearch={onChangeSearch}
        onFilterCat={onFilterCat}
        history={history}
      />
    );

    const movieButton = screen.getByText("Films");
    fireEvent.click(movieButton);
    expect(onFilterCat).toHaveBeenCalledWith(MOVIE_CATEG);

    const seriesButton = screen.getByText("Series");
    fireEvent.click(seriesButton);
    expect(onFilterCat).toHaveBeenCalledWith(SERIES_CATEG);

    const searchIcon = document.querySelector(".fa-search");
    fireEvent.click(searchIcon);

    expect(screen.getByPlaceholderText("search movie")).toBeTruthy();
  });

  it("logs out and redirects", async () => {
    logout.mockResolvedValueOnce({});
    const onChangeSearch = jest.fn();
    const onFilterCat = jest.fn();
    const history = { push: jest.fn() };

    render(
      <Header
        onChangeSearch={onChangeSearch}
        onFilterCat={onFilterCat}
        history={history}
      />
    );

    const button = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(button);

    expect(logout).toHaveBeenCalled();

    await waitFor(() => {
      expect(history.push).toHaveBeenCalledWith("/login");
    });
  });
});
