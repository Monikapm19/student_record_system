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
