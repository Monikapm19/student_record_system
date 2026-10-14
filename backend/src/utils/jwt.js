
const jwt = require("jsonwebtoken");

const JWT_EXPIRES_IN = "30m";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
}

function signToken({ sub, role }) {
  if (sub === undefined || sub === null || !role) {
    throw new Error("Token subject and role are required.");
  }

  return jwt.sign(
    { role },
    getJwtSecret(),
    {
      subject: String(sub),
      expiresIn: JWT_EXPIRES_IN,
      algorithm: "HS256",
    }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  });
}

module.exports = {
  signToken,
  verifyToken,
};
