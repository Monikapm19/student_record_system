process.env.JWT_SECRET = "test-secret-for-fr02-only";

const express = require("express");
const request = require("supertest");
const { signToken } = require("../src/utils/jwt");

jest.mock("../src/config/db", () => ({
  query: jest.fn(),
}));

const pool = require("../src/config/db");
const studentRoutes = require("../src/routes/studentRoutes");
const errorHandler = require("../src/middleware/errorHandler");

const app = express();
app.use(express.json());
app.use("/api/v1/students", studentRoutes);
app.use(errorHandler);

function tokenFor(role) {
  return signToken({ sub: "1", role });
}

const validStudent = {
  roll_no: "SR999",
  name: "Test Student",
  dob: "2005-04-12",
  department: "CSE",
  semester: 3,
  guardian_contact: "9000000099",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("FR-02 student creation API", () => {
  test("rejects requests without a token", async () => {
    const response = await request(app)
      .post("/api/v1/students")
      .send(validStudent);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects a student attempting to create a record", async () => {
    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${tokenFor("STUDENT")}`)
      .send(validStudent);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects missing mandatory fields", async () => {
    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${tokenFor("ADMIN")}`)
      .send({ roll_no: "SR999", name: "Test Student" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects a semester outside the allowed range", async () => {
    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${tokenFor("ADMIN")}`)
      .send({ ...validStudent, semester: 13 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_SEMESTER");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects an invalid date of birth", async () => {
    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${tokenFor("ADMIN")}`)
      .send({ ...validStudent, dob: "2005-02-30" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_DOB");
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("returns 409 for a duplicate roll number", async () => {
    const duplicateError = new Error("Duplicate roll number");
    duplicateError.code = "23505";
    pool.query.mockRejectedValue(duplicateError);

    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${tokenFor("ADMIN")}`)
      .send(validStudent);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DUPLICATE_ROLL_NO");
  });

  test("creates a student successfully", async () => {
    const createdStudent = {
      id: "99",
      ...validStudent,
      is_active: true,
      created_at: "2026-10-15T08:00:00.000Z",
    };

    pool.query.mockResolvedValue({
      rows: [createdStudent],
      rowCount: 1,
    });

    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${tokenFor("ADMIN")}`)
      .send(validStudent);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.roll_no).toBe("SR999");
    expect(response.body.data.name).toBe("Test Student");

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO students"),
      [
        "SR999",
        "Test Student",
        "2005-04-12",
        "CSE",
        3,
        "9000000099",
      ]
    );
  });
});