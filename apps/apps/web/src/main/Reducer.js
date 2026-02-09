export const initialState = { hasError: false, message: "" };
export const HAS_ERROR = "hasError";
export function reducer(state, { type, payload }) {
  switch (type) {
    case HAS_ERROR:
      return {
        hasError: true,
        message: payload,
      };
    default:
      return state;
  }
}
