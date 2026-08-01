/**
 * Single source of truth for password rules across:
 * Admin/User first-time setup, Forgot/Reset Password, and Change Password.
 * Used both server-side (validatePassword) and client-side (PASSWORD_REQUIREMENTS).
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export interface PasswordRequirement {
  key: "length" | "uppercase" | "lowercase" | "number" | "special";
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { key: "length", label: "At least 8 characters", test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { key: "uppercase", label: "One uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { key: "lowercase", label: "One lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { key: "number", label: "One number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { key: "special", label: "One special character (!@#$%^&*)", test: (pw) => SPECIAL_CHAR_REGEX.test(pw) },
];

const REQUIREMENT_ERRORS: Record<PasswordRequirement["key"], string> = {
  length: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
  uppercase: "Password must contain at least 1 uppercase letter (A-Z)",
  lowercase: "Password must contain at least 1 lowercase letter (a-z)",
  number: "Password must contain at least 1 number (0-9)",
  special: "Password must contain at least 1 special character (!@#$%^&*)",
};

/**
 * Backend enforcement. Returns the first violated rule's error message, or null if valid.
 * Frontend validation is UX only — this is the mandatory security gate.
 */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required";
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters long`;
  }
  for (const req of PASSWORD_REQUIREMENTS) {
    if (!req.test(password)) {
      return REQUIREMENT_ERRORS[req.key];
    }
  }
  return null;
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((r) => r.test(password));
}

export interface PasswordStrength {
  score: number;
  label: string;
  barColorClass: string;
}

/**
 * Shared strength meter used by Account Setup, Forgot/Reset Password, and Change Password.
 * UX only — never a substitute for validatePassword()/isPasswordValid().
 */
export function getPasswordStrength(password: string): PasswordStrength {
  const passed = PASSWORD_REQUIREMENTS.filter((r) => r.test(password)).length;
  if (passed <= 1) return { score: passed, label: "Very Weak", barColorClass: "bg-red-500" };
  if (passed === 2) return { score: passed, label: "Weak", barColorClass: "bg-orange-500" };
  if (passed === 3) return { score: passed, label: "Fair", barColorClass: "bg-yellow-500" };
  if (passed === 4) return { score: passed, label: "Good", barColorClass: "bg-blue-500" };
  return { score: passed, label: "Strong", barColorClass: "bg-emerald-500" };
}
