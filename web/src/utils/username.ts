/** Maximum number of ASCII characters in a writable username. */
export const MAX_USERNAME_LENGTH = 36;

const ASCII_ALPHANUMERIC = /^[A-Za-z0-9]$/;

/** Whether a character may occur anywhere in a writable username. */
export function isUsernameCharacter(char: string): boolean {
  return ASCII_ALPHANUMERIC.test(char) || char === "-";
}

/** Whether a value satisfies the writable username format. */
export function isValidUsername(username: string): boolean {
  if (username.length === 0 || username.length > MAX_USERNAME_LENGTH) return false;
  if (!ASCII_ALPHANUMERIC.test(username[0]) || !ASCII_ALPHANUMERIC.test(username.at(-1) ?? "")) return false;

  for (const char of username) {
    if (!isUsernameCharacter(char)) return false;
  }
  return true;
}
