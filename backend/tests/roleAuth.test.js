
const express = require("express");
const request = require("supertest");
const authorizeRoles = require("../src/middleware/roleAuth");

const app = express();

app.get(
  "/admin",
  (req, res, next) => {
    // Simulate an authenticated user for isolated RBAC testing.
    req.user = req.headers["x-test-role"]
      ? { id: "123", role: req.headers["x-test-role"] }
      : undefined;
    next();
  },
  authorizeRoles("ADMIN"),
  (req, res) => {
    res.status(200).json({ success: true });
  }
);

describe("SEC-02 role-based access control", () => {
  test("allows an authorized ADMIN user", async () => {
    const response = await request(app)
      .get("/admin")
      .set("x-test-role", "ADMIN");

    expect(response.status).toBe(200);
  });

  test("returns 403 for a STUDENT accessing an admin route", async () => {
    const response = await request(app)
      .get("/admin")
      .set("x-test-role", "STUDENT");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  test("returns 401 when no authenticated user exists", async () => {
    const response = await request(app).get("/admin");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  test("accepts role names without case sensitivity", async () => {
    const response = await request(app)
      .get("/admin")
      .set("x-test-role", "admin");

    expect(response.status).toBe(200);
  });

  test("accepts ADMINISTRATOR as an alias for ADMIN", async () => {
    const response = await request(app)
      .get("/admin")
      .set("x-test-role", "Administrator");

    expect(response.status).toBe(200);
  });

  test("accepts PARENT/GUARDIAN as an alias for PARENT", async () => {
    const parentApp = express();

    parentApp.get(
      "/parent",
      (req, res, next) => {
        // Simulate authentication for isolated RBAC testing.
        req.user = { id: "456", role: "Parent/Guardian" };
        next();
      },
      authorizeRoles("PARENT"),
      (req, res) => {
        res.status(200).json({ success: true });
      }
    );

    const response = await request(parentApp).get("/parent");

    expect(response.status).toBe(200);
  });
});
