const originalConsole = {
  log: console.log,
  error: console.error,
};

beforeAll(() => {
  if (process.env.JEST_SILENCE_CONSOLE !== "false") {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});
