const mockFileUseCaseFactory = jest.fn();
const mockFileLibFactory = jest.fn();

jest.mock("./FileUseCase", () => ({
  __esModule: true,
  default: (...args) => mockFileUseCaseFactory(...args),
}));

jest.mock("../../libs/FileLib", () => ({
  __esModule: true,
  default: () => mockFileLibFactory(),
}));

describe("fileUseCases index", () => {
  beforeEach(() => {
    mockFileUseCaseFactory.mockReset();
    mockFileLibFactory.mockReset();
    mockFileLibFactory.mockReturnValue({ readFile: jest.fn() });
  });

  it("builds FileUseCase with FileLib instance", async () => {
    jest.resetModules();
    await import("./index.js");

    expect(mockFileLibFactory).toHaveBeenCalled();
    expect(mockFileUseCaseFactory).toHaveBeenCalledWith({
      FileApi: expect.any(Object),
    });
  });
});
