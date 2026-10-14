
process.env.JWT_SECRET = "test-secret-for-sec04-only";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { signToken } = require("../src/utils/jwt");
const auth = require("../src/middleware/auth");
const errorHandler = require("../src/middleware/errorHandler");

const app = express();

app.get("/protected", auth, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

app.use(errorHandler);

describe("SEC-04 authentication middleware", () => {
  test("accepts a valid token and attaches user details", async () => {
    const token = signToken({ sub: "123", role: "STUDENT" });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: "123",
      role: "STUDENT",
    });
  });

  test("accepts lowercase bearer scheme", async () => {
    const token = signToken({ sub: "123", role: "STUDENT" });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `bearer ${token}`);

    expect(response.status).toBe(200);
  });

  test("rejects a missing token with 401", async () => {
    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  test("rejects an expired token with 401", async () => {
    const expiredToken = jwt.sign(
      { role: "STUDENT" },
      process.env.JWT_SECRET,
      {
        subject: "123",
        expiresIn: -1,
        algorithm: "HS256",
      }
    );

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });

  test("rejects a tampered token with 401", async () => {
    const token = signToken({ sub: "123", role: "STUDENT" });
    const parts = token.split(".");

    const firstChar = parts[2][0];
    parts[2] = (firstChar === "a" ? "b" : "a") + parts[2].slice(1);

    const tamperedToken = parts.join(".");

    expect(tamperedToken).not.toBe(token);

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${tamperedToken}`);

    expect(response.status).toBe(401);
  });

  test("rejects a malformed Bearer header with 401", async () => {
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Basic sometoken");

    expect(response.status).toBe(401);
  });

  test("forwards missing JWT_SECRET as a server configuration error", async () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    try {
      const token = "header.payload.signature";

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("JWT_CONFIGURATION_ERROR");
      expect(response.body.error.message).toBe(
        "An internal server error occurred."
      );
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});
