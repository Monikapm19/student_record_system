
const router = require("express").Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");
const authorizeRoles = require("../middleware/roleAuth");
const { successResponse } = require("../utils/response");

const VALID_STATUSES = ["Present", "Absent", "Late"];
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// POST /api/v1/attendance
// Mark attendance for multiple students in one session.
// Body: { sessionDate: "YYYY-MM-DD", records: [{ enrolmentId, status }] }
router.post(
  "/",
  auth,
  authorizeRoles("FACULTY"),
  async (req, res, next) => {
    const { sessionDate, records } = req.body;

    if (
      typeof sessionDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) ||
      !Array.isArray(records) ||
      records.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message:
            "Provide a valid sessionDate and a non-empty records array.",
        },
      });
    }

    const parsedDate = new Date(`${sessionDate}T00:00:00Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== sessionDate
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_SESSION_DATE",
          message: "sessionDate must be a valid calendar date.",
        },
      });
    }

    const enrolmentIds = records.map((record) => record?.enrolmentId);

    if (
      enrolmentIds.some(
        (id) =>
          (typeof id !== "string" && typeof id !== "number") ||
          !/^\d+$/.test(String(id)) ||
          String(id) === "0"
      ) ||
      new Set(enrolmentIds.map(String)).size !== enrolmentIds.length ||
      records.some(
        (record) => !VALID_STATUSES.includes(record?.status)
      )
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_INPUT",
          message:
            "Each record must contain a unique enrolmentId and a valid attendance status.",
        },
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const facultyResult = await client.query(
        "SELECT id FROM faculty WHERE user_id = $1",
        [req.user.id]
      );

      if (facultyResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          success: false,
          error: {
            code: "FACULTY_PROFILE_NOT_FOUND",
            message: "No faculty profile is associated with this account.",
          },
        });
      }

      const facultyId = facultyResult.rows[0].id;
      const inserted = [];

      for (const record of records) {
        const enrolmentResult = await client.query(
          `SELECT e.id
           FROM enrolments e
           JOIN courses c ON c.id = e.course_id
           WHERE e.id = $1 AND c.faculty_id = $2
           FOR UPDATE OF e`,
          [record.enrolmentId, facultyId]
        );

        if (enrolmentResult.rowCount === 0) {
          const error = new Error(
            "An enrolment does not belong to a course assigned to you."
          );
          error.status = 403;
          error.code = "COURSE_ACCESS_DENIED";
          throw error;
        }

        const result = await client.query(
          `INSERT INTO attendance_records
             (enrolment_id, session_date, status, marked_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id, enrolment_id, session_date, status, marked_by, marked_at`,
          [
            record.enrolmentId,
            sessionDate,
            record.status,
            req.user.id,
          ]
        );

        inserted.push(result.rows[0]);
      }

      await client.query("COMMIT");

      return successResponse(
        res,
        inserted,
        "Attendance marked successfully.",
        201
      );
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          error.rollbackError = rollbackError;
        }
      }

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          error: {
            code: "DUPLICATE_ATTENDANCE",
            message:
              "Attendance already exists for an enrolment on this session date.",
          },
        });
      }

      return next(error);
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// PUT /api/v1/attendance/:id
// Faculty may edit within 24 hours. Administrators may edit at any time.
// Body: { status: "Present" | "Absent" | "Late" }
router.put(
  "/:id",
  auth,
  authorizeRoles("FACULTY", "ADMIN"),
  async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ID",
          message: "A valid attendance record ID is required.",
        },
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Status must be Present, Absent, or Late.",
        },
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const attendanceResult = await client.query(
        `SELECT ar.id, ar.status, ar.marked_at, ar.marked_by,
                c.faculty_id
         FROM attendance_records ar
         JOIN enrolments e ON e.id = ar.enrolment_id
         JOIN courses c ON c.id = e.course_id
         WHERE ar.id = $1
         FOR UPDATE OF ar`,
        [id]
      );

      if (attendanceResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          error: {
            code: "ATTENDANCE_NOT_FOUND",
            message: "Attendance record not found.",
          },
        });
      }

      const attendance = attendanceResult.rows[0];
      const role = String(req.user.role).trim().toUpperCase();
      const isAdmin = ["ADMIN", "ADMINISTRATOR"].includes(role);

      if (!isAdmin) {
        const facultyResult = await client.query(
          "SELECT id FROM faculty WHERE user_id = $1",
          [req.user.id]
        );

        if (
          facultyResult.rowCount === 0 ||
          String(facultyResult.rows[0].id) !==
            String(attendance.faculty_id)
        ) {
          const error = new Error(
            "You can edit attendance only for your assigned courses."
          );
          error.status = 403;
          error.code = "COURSE_ACCESS_DENIED";
          throw error;
        }

        const markedAt = new Date(attendance.marked_at).getTime();
        const age = Date.now() - markedAt;

        if (
          !Number.isFinite(markedAt) ||
          age < 0 ||
          age > EDIT_WINDOW_MS
        ) {
          const error = new Error(
            "Faculty can edit attendance only within 24 hours of marking it."
          );
          error.status = 403;
          error.code = "EDIT_WINDOW_EXPIRED";
          throw error;
        }
      }

      const updateResult = await client.query(
        `UPDATE attendance_records
         SET status = $1
         WHERE id = $2
         RETURNING id, enrolment_id, session_date, status, marked_by, marked_at`,
        [status, id]
      );

      await client.query("COMMIT");

      return successResponse(
        res,
        updateResult.rows[0],
        "Attendance updated successfully."
      );
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          error.rollbackError = rollbackError;
        }
      }

      return next(error);
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

module.exports = router;
