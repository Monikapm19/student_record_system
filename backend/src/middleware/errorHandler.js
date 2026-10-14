function errorHandler(err, req, res, next) {
  console.error(err);

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message:
        statusCode >= 500
          ? "An internal server error occurred."
          : err.message,
    },
  });
}

module.exports = errorHandler;