const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

function validatePasswordRules(password) {
  if (typeof password !== "string" || password.length < 8) {
    return false;
  }

  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

async function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string.");
  }

  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, passwordHash) {
  if (typeof password !== "string" || typeof passwordHash !== "string") {
    return false;
  }

  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}

module.exports = {
  validatePasswordRules,
  hashPassword,
  verifyPassword,
};
