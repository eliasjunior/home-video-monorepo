import { ensureCsrf } from "./csrf";

describe("ensureCsrf", () => {
  function createResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };
  }

  it("returns true when csrf header matches csrf cookie", () => {
    const req = {
      headers: {
        "x-csrf-token": "abc123",
        cookie: "csrf_token=abc123; other=1",
      },
    };
    const res = createResponse();

    const result = ensureCsrf({ req, res });

    expect(result).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns false and sends 403 when csrf is missing or mismatched", () => {
    const req = {
      headers: {
        "x-csrf-token": "abc123",
        cookie: "csrf_token=xyz999; other=1",
      },
    };
    const res = createResponse();

    const result = ensureCsrf({ req, res });

    expect(result).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid CSRF token" });
  });
});

