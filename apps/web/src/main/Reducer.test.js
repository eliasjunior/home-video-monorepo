import { HAS_ERROR, initialState, reducer } from "./Reducer";

describe("Reducer", () => {
  it("returns initial state", () => {
    expect(initialState).toEqual({ hasError: false, message: "" });
  });

  it("handles HAS_ERROR", () => {
    const state = reducer(initialState, { type: HAS_ERROR, payload: "oops" });
    expect(state).toEqual({ hasError: true, message: "oops" });
  });

  it("returns current state for unknown action", () => {
    const state = reducer(initialState, { type: "unknown" });
    expect(state).toBe(initialState);
  });
});
