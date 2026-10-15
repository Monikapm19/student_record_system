
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

function studentToken() {
  return signToken({ sub: "200", role: "Student" });
}

function mockClientQuery(implementation) {
  client.query.mockImplementation(implementation);
  pool.connect.mockResolvedValue(client);
}

function transactionResult() {
  return { rowCount: null, rows: [] };
}

function facultyProfile() {
  return { rowCount: 1, rows: [{ id: "10" }] };
}

function attendanceRecord(overrides = {}) {
  return {
    id: "30",
    status: "Absent",
    marked_at: new Date(Date.now() - 60 * 60 * 1000),
    marked_by: "100",
    faculty_id: "10",
    ...overrides,
  };
}

function updatedAttendance(status = "Present") {
  return {
    id: "30",
    enrolment_id: "20",
    session_date: "2026-10-15",
    status,
    marked_by: "100",
    marked_at: new Date().toISOString(),
  };
}

beforeEach(() => {
  client = {
    query: jest.fn(),
    release: jest.fn(),
  };

  pool.connect.mockReset();
});

describe("FR-08 attendance validation and authorization", () => {
  test("rejects marking attendance without a token", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 20, status: "Present" }],
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects editing attendance without a token", async () => {
    const response = await request(app)
      .put("/api/v1/attendance/30")
      .send({ status: "Absent" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects a student attempting to mark attendance", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${studentToken()}`)
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 20, status: "Present" }],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects a student attempting to edit attendance", async () => {
    const response = await request(app)
      .put("/api/v1/attendance/30")
      .set("Authorization", `Bearer ${studentToken()}`)
      .send({ status: "Present" });

    expect(response.status).toBe(403);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects an invalid attendance status", async () => {
    const response = await request(app)
      .put("/api/v1/attendance/30")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ status: "Excused" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_STATUS");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects an invalid attendance record ID", async () => {
    const response = await request(app)
      .put("/api/v1/attendance/abc")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ status: "Present" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_ID");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test.each([
    ["15-10-2026", "INVALID_INPUT"],
    ["2026-02-30", "INVALID_SESSION_DATE"],
    ["not-a-date", "INVALID_INPUT"],
  ])("rejects invalid session date %s", async (sessionDate, errorCode) => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate,
        records: [{ enrolmentId: 20, status: "Present" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(errorCode);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects an empty attendance batch", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate: "2026-10-15",
        records: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects a missing attendance records array", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ sessionDate: "2026-10-15" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects duplicate enrolment IDs in the same batch", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate: "2026-10-15",
        records: [
          { enrolmentId: 20, status: "Present" },
          { enrolmentId: 20, status: "Absent" },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects invalid enrolment IDs in a batch", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 0, status: "Present" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("rejects invalid statuses in a batch", async () => {
    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 20, status: "Excused" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe("FR-08 attendance marking database behavior", () => {
  test("marks attendance successfully for an assigned course", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return facultyProfile();
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

  test("rejects marking attendance for another faculty member's course", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return facultyProfile();
      }

      if (sql.includes("FROM enrolments e")) {
        return { rowCount: 0, rows: [] };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .post("/api/v1/attendance")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({
        sessionDate: "2026-10-15",
        records: [{ enrolmentId: 99, status: "Present" }],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("COURSE_ACCESS_DENIED");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  test("rejects marking attendance when the faculty profile is missing", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return { rowCount: 0, rows: [] };
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

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FACULTY_PROFILE_NOT_FOUND");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  test("returns 409 for duplicate attendance in the database", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return facultyProfile();
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
    expect(client.release).toHaveBeenCalled();
  });
});

describe("FR-08 attendance editing database behavior", () => {
  test("allows faculty to edit attendance within 24 hours", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT ar.id")) {
        return { rowCount: 1, rows: [attendanceRecord()] };
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return facultyProfile();
      }

      if (sql.includes("UPDATE attendance_records")) {
        return { rowCount: 1, rows: [updatedAttendance("Present")] };
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

  test("rejects faculty editing attendance for another faculty member's course", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT ar.id")) {
        return {
          rowCount: 1,
          rows: [attendanceRecord({ faculty_id: "99" })],
        };
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return facultyProfile();
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .put("/api/v1/attendance/30")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ status: "Present" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("COURSE_ACCESS_DENIED");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  test("rejects faculty edits after 24 hours", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT ar.id")) {
        return {
          rowCount: 1,
          rows: [
            attendanceRecord({
              marked_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
            }),
          ],
        };
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return facultyProfile();
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

  test("allows faculty to edit attendance at exactly 24 hours", async () => {
    const fixedNow = new Date("2026-10-15T12:00:00.000Z").getTime();
    jest.useFakeTimers({ now: fixedNow });

    try {
      mockClientQuery(async (sql) => {
        if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
          return transactionResult();
        }

        if (sql.includes("SELECT ar.id")) {
          return {
            rowCount: 1,
            rows: [
              attendanceRecord({
                marked_at: new Date(
                  fixedNow - 24 * 60 * 60 * 1000
                ),
              }),
            ],
          };
        }

        if (sql.includes("SELECT id FROM faculty")) {
          return facultyProfile();
        }

        if (sql.includes("UPDATE attendance_records")) {
          return {
            rowCount: 1,
            rows: [updatedAttendance("Present")],
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
    } finally {
      jest.useRealTimers();
    }
  });

  test("rejects faculty edits when the marked time is in the future", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT ar.id")) {
        return {
          rowCount: 1,
          rows: [
            attendanceRecord({
              marked_at: new Date(Date.now() + 60 * 60 * 1000),
            }),
          ],
        };
      }

      if (sql.includes("SELECT id FROM faculty")) {
        return facultyProfile();
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

  test("returns 404 when the attendance record does not exist", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT ar.id")) {
        return { rowCount: 0, rows: [] };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .put("/api/v1/attendance/999")
      .set("Authorization", `Bearer ${facultyToken()}`)
      .send({ status: "Present" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ATTENDANCE_NOT_FOUND");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  test("allows an administrator to edit attendance after 24 hours", async () => {
    mockClientQuery(async (sql) => {
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
        return transactionResult();
      }

      if (sql.includes("SELECT ar.id")) {
        return {
          rowCount: 1,
          rows: [
            attendanceRecord({
              marked_at: new Date(Date.now() - 48 * 60 * 60 * 1000),
            }),
          ],
        };
      }

      if (sql.includes("UPDATE attendance_records")) {
        return { rowCount: 1, rows: [updatedAttendance("Present")] };
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
