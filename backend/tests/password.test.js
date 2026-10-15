
const {
  hashPassword,
  verifyPassword,
  validatePasswordRules,
} = require("../src/utils/password");

describe("Password security", () => {
  test("hashes a password without storing plain text", async () => {
    const password = "unit-test-value";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  test("verifies the correct password", async () => {
    const value = "unit-test-value";
    const hash = await hashPassword(value);

    await expect(verifyPassword(value, hash)).resolves.toBe(true);
  });

  test("rejects an incorrect password", async () => {
    const hash = await hashPassword("unit-test-value");

    await expect(
      verifyPassword("different-test-value", hash)
    ).resolves.toBe(false);
  });

  test("rejects invalid verification inputs", async () => {
    await expect(
      verifyPassword(null, "synthetic-hash")
    ).resolves.toBe(false);

    await expect(
      verifyPassword("unit-test-value", null)
    ).resolves.toBe(false);
  });

  test("rejects an empty password when hashing", async () => {
    await expect(hashPassword("")).rejects.toThrow(
      "Password must be a non-empty string."
    );
  });
});

describe("Password rules validation", () => {
  test("accepts a password meeting all rules", () => {
    expect(validatePasswordRules("Secure123")).toBe(true);
  });

  test("rejects inputs shorter than 8 characters", () => {
    expect(validatePasswordRules("x7")).toBe(false);
  });

  test("rejects a value without an uppercase letter", () => {
    expect(validatePasswordRules("secure123")).toBe(false);
  });

  test("rejects a value without a lowercase letter", () => {
    expect(validatePasswordRules("SECURE123")).toBe(false);
  });

  test("rejects a value without a digit", () => {
    expect(validatePasswordRules("SecurePass")).toBe(false);
  });

  test("rejects non-string and empty inputs", () => {
    expect(validatePasswordRules("")).toBe(false);
    expect(validatePasswordRules(null)).toBe(false);
    expect(validatePasswordRules(12345678)).toBe(false);
  });
});
