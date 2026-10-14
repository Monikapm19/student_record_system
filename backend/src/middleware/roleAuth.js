
const ROLE_ALIASES = {
  ADMIN: "ADMIN",
  ADMINISTRATOR: "ADMIN",
  FACULTY: "FACULTY",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
  PARENT_GUARDIAN: "PARENT",
  "PARENT/GUARDIAN": "PARENT",
};

function normalizeRole(role) {
  if (typeof role !== "string") {
    return null;
  }

  return ROLE_ALIASES[role.trim().toUpperCase()] || null;
}

function authorizeRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map(normalizeRole);

  if (
    normalizedRoles.length === 0 ||
    normalizedRoles.some((role) => role === null)
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
