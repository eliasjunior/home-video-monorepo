import {
  getImageUrl,
  removeSpecialCharacters,
  requiredParameter,
  printMemoryUsage,
  parseCookies,
  getCookie,
} from "./Util";

describe("Util", () => {
  it("should get the url from the images map", () => {
    const movieMap = {
      ema2019: {
        folder: "ema",
        imgName: "ema.jpg",
        year: "2019",
      },
    };

    const result = getImageUrl(
      "ema2019",
      movieMap,
      "http://localhost:80/images"
    );

    expect(result).toEqual("http://localhost:80/images/ema/ema.jpg");
  });

  it("returns empty string when folder name is missing", () => {
    const result = removeSpecialCharacters();

    expect(result).toBe("");
  });

  it("removes special characters from folder name", () => {
    const result = removeSpecialCharacters("Harry Potter! (2010)");

    expect(result).toBe("HarryPotter2010");
  });

  it("returns empty string when image is not found", () => {
    const result = getImageUrl(
      "unknown",
      {},
      "http://localhost:80/images"
    );

    expect(result).toBe("");
  });

  it("throws when requiredParameter is missing by default", () => {
    expect(() => requiredParameter("value")).toThrow("value is required");
  });

  it("logs when requiredParameter is missing but isThrow is false", () => {
    const originalError = console.error;
    console.error = jest.fn();

    requiredParameter("value", false);

    expect(console.error).toHaveBeenCalledWith("value is required *");
    console.error = originalError;
  });

  it("prints memory usage", () => {
    const originalLog = console.log;
    const originalMemoryUsage = process.memoryUsage;
    console.log = jest.fn();
    process.memoryUsage = () => ({ heapTotal: 1048576 });

    printMemoryUsage();

    expect(console.log).toHaveBeenCalled();
    console.log = originalLog;
    process.memoryUsage = originalMemoryUsage;
  });

  it("parses cookies from header", () => {
    const cookies = parseCookies("a=1; b=two; c=three");
    expect(cookies).toEqual({ a: "1", b: "two", c: "three" });
  });

  it("gets cookie by name", () => {
    const req = { headers: { cookie: "token=abc; theme=dark" } };
    expect(getCookie(req, "token")).toBe("abc");
    expect(getCookie(req, "missing")).toBeUndefined();
  });
});
