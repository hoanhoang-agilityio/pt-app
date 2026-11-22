export type PasswordProblem = "required" | "tooShort" | "mismatch" | "same";

// Checks the change-password form before a request (the API checks again).
export const validatePasswordChange = (
  current: string,
  next: string,
  repeat: string,
  min: number,
  max: number,
): PasswordProblem | null => {
  if (current.length === 0) {
    return "required";
  }
  if (next.length < min || next.length > max) {
    return "tooShort";
  }
  if (next === current) {
    return "same";
  }
  if (repeat !== next) {
    return "mismatch";
  }
  return null;
};
