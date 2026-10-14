
const { verifyToken } = require("../utils/jwt");

function auth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !/^Bearer\s+/i.test(authorization)) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token is missing or invalid.",
      },
    });
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token is missing or invalid.",
      },
    });
  }

  let payload;

  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error.message === "JWT_SECRET is not configured.") {
      error.status = 500;
      error.code = "JWT_CONFIGURATION_ERROR";
      return next(error);
    }

    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token is invalid or expired.",
      },
    });
  }

  if (!payload.sub || !payload.role) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token is invalid.",
      },
    });
  }

  req.user = {
    id: payload.sub,
    role: payload.role,
  };

  return next();
}

module.exports = auth;
