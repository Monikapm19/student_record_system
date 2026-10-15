const { hashPassword, verifyPassword } = require("../src/utils/password");

describe("Password security", () => {
  test("hashes a password without storing plain text", async () => {
    const password = "Test@1234";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  test("verifies the correct password", async () => {
    const hash = await hashPassword("Test@1234");
    await expect(verifyPassword("Test@1234", hash)).resolves.toBe(true);
  });

  test("rejects an incorrect password", async () => {
    const hash = await hashPassword("Test@1234");
    await expect(verifyPassword("WrongPassword", hash)).resolves.toBe(false);
  });

  test("rejects invalid verification inputs", async () => {
    await expect(verifyPassword(null, "some-hash")).resolves.toBe(false);
    await expect(verifyPassword("password", null)).resolves.toBe(false);
  });

  test("rejects an empty password when hashing", async () => {
    await expect(hashPassword("")).rejects.toThrow(
      "Password must be a non-empty string."
    );
  });
});

describe("Password rules validation", () => {
  const { validatePasswordRules } = require("../src/utils/password");

  test("accepts a password meeting all rules", () => {
    expect(validatePasswordRules("Secure123")).toBe(true);
  });

  test("rejects passwords shorter than 8 characters", () => {
    expect(validatePasswordRules("Abc123")).toBe(false);
  });

  test("rejects a password without an uppercase letter", () => {
    expect(validatePasswordRules("secure123")).toBe(false);
  });

  test("rejects a password without a lowercase letter", () => {
    expect(validatePasswordRules("SECURE123")).toBe(false);
  });

  test("rejects a password without a digit", () => {
    expect(validatePasswordRules("SecurePass")).toBe(false);
  });

  test("rejects non-string and empty inputs", () => {
    expect(validatePasswordRules("")).toBe(false);
    expect(validatePasswordRules(null)).toBe(false);
    expect(validatePasswordRules(12345678)).toBe(false);
  });
});
