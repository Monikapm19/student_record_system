
const fs = require("fs");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "student_record_system",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

async function resetDatabase() {
  const schemaPath = path.resolve(__dirname, "../../db/schema.sql");
  const seedPath = path.resolve(__dirname, "../../db/seed.sql");

  try {
    const schema = fs.readFileSync(schemaPath, "utf8");
    const seed = fs.readFileSync(seedPath, "utf8");

    await pool.query(`
      DROP TABLE IF EXISTS
        audit_log,
        parent_links,
        grievances,
        attendance_records,
        grades,
        enrolments,
        courses,
        faculty,
        students,
        users
      CASCADE;
    `);

    await pool.query(schema);
    await pool.query(seed);

    console.log("Database schema and sample data reset successfully.");
  } catch (error) {
    console.error("Database reset failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

resetDatabase();
