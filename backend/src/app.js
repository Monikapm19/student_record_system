
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { successResponse } = require("./utils/response");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const facultyRoutes = require("./routes/facultyRoutes");
const courseRoutes = require("./routes/courseRoutes");
const gradeRoutes = require("./routes/gradeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const grievanceRoutes = require("./routes/grievanceRoutes");
const parentRoutes = require("./routes/parentRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/v1/health", (req, res) => {
  return successResponse(
    res,
    {
      status: "healthy",
      service: "Student Record System API",
    },
    "Health check successful"
  );
});

// API route groups
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/faculty", facultyRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/grades", gradeRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/grievances", grievanceRoutes);
app.use("/api/v1/parent", parentRoutes);
app.use("/api/v1/admin", adminRoutes);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint was not found.",
    },
  });
});

// Central error handler must be registered last
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Student Record System API running on port ${PORT}`);
  });
}

module.exports = app;
