let consoleErrorSpy;
const originalConsoleError = console.error;

beforeAll(() => {
  consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation((message, ...args) => {
      const text = String(message || "");
      if (
        text.includes("ReactDOM.render is no longer supported in React 18") ||
        text.includes("unmountComponentAtNode is deprecated") ||
        text.includes("ReactDOMTestUtils.act is deprecated")
      ) {
        return;
      }
      originalConsoleError(message, ...args);
    });
});

afterAll(() => {
  if (consoleErrorSpy) {
    consoleErrorSpy.mockRestore();
  }
});
