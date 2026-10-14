
const ROLE_ALIASES = {
  ADMIN: "ADMIN",
  ADMINISTRATOR: "ADMIN",
  FACULTY: "FACULTY",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
  GUARDIAN: "PARENT",
  "PARENT/GUARDIAN": "PARENT",
  "PARENT_GUARDIAN": "PARENT",
};

function normalizeRole(role) {
  return ROLE_ALIASES[String(role).trim().toUpperCase()];
}

function authorizeRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map(normalizeRole);

  if (
    normalizedRoles.some((role) => !role) ||
    normalizedRoles.length === 0
  ) {
    throw new Error("Invalid or missing role configuration.");
  }

  return function roleAuthorization(req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication is required.",
        },
      });
    }

    const userRole = normalizeRole(req.user.role);

    if (!userRole || !normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this resource.",
        },
      });
    }

    return next();
  };
}

module.exports = authorizeRoles;
