import FileLib from "./FileLib";
import fs from "fs";

jest.mock("fs", () => ({
  statSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  accessSync: jest.fn(),
  constants: { R_OK: 4, F_OK: 0 },
}));

jest.mock("../common/MessageUtil", () => ({
  logE: jest.fn(),
  logD: jest.fn(),
}));

describe("FileLib", () => {
  const fileLib = FileLib();

  beforeEach(() => {
    fs.readdirSync.mockReset();
    fs.readFileSync.mockReset();
  });

  it("readDirectory returns [] when fs throws", () => {
    fs.readdirSync.mockImplementationOnce(() => {
      throw new Error("fail");
    });

    const result = fileLib.readDirectory("/bad");

    expect(result).toEqual([]);
  });

  it("readFile throws when fs throws", () => {
    fs.readFileSync.mockImplementationOnce(() => {
      throw new Error("fail");
    });

    expect(() => fileLib.readFile("/bad")).toThrow("fail");
  });

  it("readFile returns buffer when encoding is none", () => {
    const buf = Buffer.from("x");
    fs.readFileSync.mockReturnValueOnce(buf);

    const result = fileLib.readFile("/file", "none");

    expect(result).toBe(buf);
  });

  it("readJson returns undefined when parsing fails", () => {
    const result = fileLib.readJson("{bad json}");
    expect(result).toBeUndefined();
  });
});
