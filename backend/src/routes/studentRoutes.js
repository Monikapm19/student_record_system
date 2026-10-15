const express = require("express");
const pool = require("../config/db");
const auth = require("../middleware/auth");
const authorizeRoles = require("../middleware/roleAuth");
const { successResponse, errorResponse } = require("../utils/response");

const router = express.Router();

router.post("/", auth, authorizeRoles("ADMIN"), async (req, res, next) => {
  try {
    const { roll_no, name, dob, department, semester, guardian_contact } =
      req.body || {};

    if (
      typeof roll_no !== "string" ||
      !roll_no.trim() ||
      typeof name !== "string" ||
      !name.trim() ||
      typeof dob !== "string" ||
      !dob.trim() ||
      typeof department !== "string" ||
      !department.trim() ||
      semester === undefined ||
      semester === null ||
      semester === ""
    ) {
      return errorResponse(
        res,
        "INVALID_INPUT",
        "Roll number, name, date of birth, department, and semester are required.",
        400
      );
    }

    const parsedSemester = Number(semester);

    if (
      !Number.isInteger(parsedSemester) ||
      parsedSemester < 1 ||
      parsedSemester > 12
    ) {
      return errorResponse(
        res,
        "INVALID_SEMESTER",
        "Semester must be an integer between 1 and 12.",
        400
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return errorResponse(
        res,
        "INVALID_DOB",
        "Date of birth must use YYYY-MM-DD format.",
        400
      );
    }

    const date = new Date(`${dob}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dob
    ) {
      return errorResponse(
        res,
        "INVALID_DOB",
        "Please provide a valid date of birth.",
        400
      );
    }

    if (date > new Date()) {
      return errorResponse(
        res,
        "INVALID_DOB",
        "Date of birth cannot be in the future.",
        400
      );
    }

    if (
      roll_no.trim().length > 30 ||
      name.trim().length > 100 ||
      department.trim().length > 100
    ) {
      return errorResponse(
        res,
        "INVALID_INPUT",
        "One or more fields exceed the allowed length.",
        400
      );
    }

    if (
      guardian_contact !== undefined &&
      guardian_contact !== null &&
      (typeof guardian_contact !== "string" ||
        guardian_contact.length > 30)
    ) {
      return errorResponse(
        res,
        "INVALID_INPUT",
        "Guardian contact must be a string of at most 30 characters.",
        400
      );
    }

    const result = await pool.query(
      `INSERT INTO students
        (roll_no, name, dob, department, semester, guardian_contact)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, roll_no, name, dob, department, semester,
                 guardian_contact, is_active, created_at`,
      [
        roll_no.trim(),
        name.trim(),
        dob,
        department.trim(),
        parsedSemester,
        guardian_contact == null ? null : guardian_contact,
      ]
    );

    return successResponse(
      res,
      result.rows[0],
      "Student record created successfully.",
      201
    );
  } catch (error) {
    if (error.code === "23505") {
      return errorResponse(
        res,
        "DUPLICATE_ROLL_NO",
        "A student with this roll number already exists.",
        409
      );
    }

    return next(error);
  }
});

module.exports = router;