export const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const STORAGE_KEYS = {
  AccessToken: "knk.accessToken",
  RefreshToken: "knk.refreshToken",
  RememberMe: "knk.rememberMe",
  RememberMeExpiresAt: "knk.rememberMe.expiresAt"
};

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 16;
export const LINK_CODE_EXPIRY_MINUTES = 20;

// Note: backend maintains the full compromised password list; this subset is for quick client checks
export const WEAK_PASSWORDS = new Set<string>([
  "123456",
  "123456789",
  "12345678",
  "password",
  "qwerty",
  "111111",
  "123123",
  "1234567",
  "dragon",
  "baseball",
  "1234567890",
  "abc123",
  "password1",
  "letmein",
  "welcome",
  "monkey",
  "dragon123",
  "qazwsx"
]);

export const ERROR_MESSAGES: Record<string, string> = {
  DuplicateEmail: "Email already registered. Try logging in or use a different email.",
  DuplicateUsername: "Minecraft username already taken. Try a variation.",
  InvalidPassword: "Password is too common. Choose something stronger.",
  PasswordMismatch: "Passwords do not match.",
  InvalidEmail: "Please enter a valid email address.",
  InvalidUsername: "Username must be 3-16 alphanumeric characters (underscore allowed).",
  LinkCodeExpired: "Link code expired (valid for 20 minutes).",
  InvalidCredentials: "Email or password is incorrect.",
  NetworkError: "Network error. Please try again.",
  ServerError: "Server error. Please try again later.",
  RegistrationFailed: "Registration failed. Please check your information and try again."
};

export const SUCCESS_MESSAGES: Record<string, string> = {
  RegistrationComplete:
    "Account created successfully. Your link code is ready. Use it on the Minecraft server to link your account.",
  LinkCodeCopied: "Link code copied to clipboard."
};