
process.env.JWT_SECRET = "attendance-tests-only-secret";

jest.mock("../src/config/db", () => ({
  connect: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const pool = require("../src/config/db");
const { signToken } = require("../src/utils/jwt");
const attendanceRoutes = require("../src/routes/attendanceRoutes");
const errorHandler = require("../src/middleware/errorHandler");

const app = express();
app.use(express.json());
app.use("/api/v1/attendance", attendanceRoutes);
app.use(errorHandler);

let client;

function facultyToken() {
  return signToken({ sub: "100", role: "Faculty" });
}

function adminToken() {
  return signToken({ sub: "1", role: "Admin" });
}

function mockClientQuery(implementation) {
  client.query.mockImplementation(implementation);
  pool.connect.mockResolvedValue(client);
}

beforeEach(() => {
  client = {
    query: jest.fn(),
    release: jest.fn(),
  };
  pool.connect.mockReset();
});

describe("FR-08 attendance API validation and authorization", () => {
  test("rejects marking attendance without a token", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 1, status: "Present" }],
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  test("rejects editing attendance without a token", async () => {
    const response = await request(app)
      .put("/api/v1/attendance/1")
      .send({ status: "Absent" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  test("rejects a student attempting to mark attendance", async () => {
    const token = signToken({ sub: "200", role: "Student" });

    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 1, status: "Present" }],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  test("rejects an invalid attendance status", async () => {
    const response = await request(app)
      .put("/api/v1/attendance/1")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ status: "Excused" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_STATUS");
  });

  test("rejects an invalid attendance record ID", async () => {
    const response = await request(app)
      .put("/api/v1/attendance/abc")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ status: "Present" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ID");
  });

  test("rejects an invalid session date format", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate: "15-10-2026",
        records: [{ enrolmentId: 1, status: "Present" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
  });
});

describe("FR-08 attendance database behavior", () => {
  test("marks attendance successfully for an assigned course", async () => {
    mockClientQuery(async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rowCount: null, rows: [] };
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return { rowCount: 1, rows: [{ id: "10" }] };
      }

      if (sql.includes("FROM enrolments e")) {
        return { rowCount: 1, rows: [{ id: "20" }] };
      }

      if (sql.includes("INSERT INTO attendance_records")) {
        return {
          rowCount: 1,
          rows: [{
            id: "30",
            enrolment_id: "20",
            session_date: "2026-10-15",
            status: "Present",
            marked_by: "100",
            marked_at: new Date().toISOString(),
          }],
        };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 20, status: "Present" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].status).toBe("Present");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  test("returns 409 for duplicate attendance", async () => {
    mockClientQuery(async (sql) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rowCount: null, rows: [] };
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return { rowCount: 1, rows: [{ id: "10" }] };
      }

      if (sql.includes("FROM enrolments e")) {
        return { rowCount: 1, rows: [{ id: "20" }] };
      }

      if (sql.includes("INSERT INTO attendance_records")) {
        const error = new Error("duplicate");
        error.code = "23505";
        throw error;
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 20, status: "Present" }],
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("DUPLICATE_ATTENDANCE");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  test("allows faculty to edit attendance within 24 hours", async () => {
    mockClientQuery(async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rowCount: null, rows: [] };
      }

      if (sql.includes("SELECT ar.id")) {
        return {
          rowCount: 1,
          rows: [{
            id: "30",
            status: "Absent",
            marked_at: new Date(Date.now() - 60 * 60 * 1000),
            marked_by: "100",
            faculty_id: "10",
          }],
        };
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return { rowCount: 1, rows: [{ id: "10" }] };
      }

      if (sql.includes("UPDATE attendance_records")) {
        return {
          rowCount: 1,
          rows: [{
            id: "30",
            enrolment_id: "20",
            session_date: "2026-10-15",
            status: "Present",
            marked_by: "100",
            marked_at: new Date().toISOString(),
          }],
        };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .put("/api/v1/attendance/30")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ status: "Present" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("Present");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });

  test("rejects faculty edits after 24 hours", async () => {
    mockClientQuery(async (sql) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rowCount: null, rows: [] };
      }

      if (sql.includes("SELECT ar.id")) {
        return {
          rowCount: 1,
          rows: [{
            id: "30",
            status: "Absent",
            marked_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
            marked_by: "100",
            faculty_id: "10",
          }],
        };
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return { rowCount: 1, rows: [{ id: "10" }] };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .put("/api/v1/attendance/30")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ status: "Present" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("EDIT_WINDOW_EXPIRED");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  test("allows an administrator to edit attendance after 24 hours", async () => {
    mockClientQuery(async (sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rowCount: null, rows: [] };
      }

      if (sql.includes("SELECT ar.id")) {
        return {
          rowCount: 1,
          rows: [{
            id: "30",
            status: "Absent",
            marked_at: new Date(Date.now() - 48 * 60 * 60 * 1000),
            marked_by: "100",
            faculty_id: "10",
          }],
        };
      }

      if (sql.includes("UPDATE attendance_records")) {
        return {
          rowCount: 1,
          rows: [{
            id: "30",
            enrolment_id: "20",
            session_date: "2026-10-13",
            status: "Present",
            marked_by: "100",
            marked_at: new Date().toISOString(),
          }],
        };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .put("/api/v1/attendance/30")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ status: "Present" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("Present");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });
});
