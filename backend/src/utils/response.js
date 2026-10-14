function successResponse(res, data, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {},
  });
}

function errorResponse(
  res,
  code,
  message,
  statusCode = 500
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}

module.exports = {
  successResponse,
  errorResponse,
};