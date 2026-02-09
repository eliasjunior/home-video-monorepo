import { getMoviesMap, setMoviesMap } from "./MemoryLib";

describe("MemoryLib", () => {
  it("stores and returns the movies map", () => {
    const value = { a: 1 };
    setMoviesMap(value);
    expect(getMoviesMap()).toEqual(value);
  });
});
