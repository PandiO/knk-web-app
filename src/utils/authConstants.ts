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
  // Matches backend PasswordService.WeakPasswords
  "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234", "111111",
  "1234567", "dragon", "123123", "baseball", "abc123", "football", "monkey", "letmein",
  "shadow", "master", "666666", "qwertyuiop", "123321", "mustang", "1234567890",
  "michael", "654321", "superman", "1qaz2wsx", "7777777", "121212", "000000", "qazwsx",
  "admin", "admin123", "root", "toor", "pass", "test", "guest", "info", "adm", "mysql",
  "user", "administrator", "oracle", "ftp", "pi", "puppet", "ansible", "ec2-user", "vagrant",
  "password1", "password123", "welcome", "welcome123", "login", "passw0rd", "Password1",
  "abc123456", "123qwe", "qwerty123", "iloveyou", "princess", "admin1", "1q2w3e4r",
  "sunshine", "ashley", "bailey", "passw0rd", "shadow1", "123456a", "password1!", "trustno1",
  "1qazxsw2", "charlie", "123abc", "password!", "qwerty1", "monkey1", "liverpool",
  "654321a", "master123", "starwars", "passw0rd!", "football1", "batman", "access",
  "1234qwer", "trustno1", "rangers", "jordan23", "hello", "qwertyui", "lovely",
  "ninja", "azerty", "solo", "flower", "000000", "hottie", "loveme", "zaq1zaq1",
  "password12", "Welcome1", "whatever", "donald", "dragon1", "michael1", "michelle",
  "passw0rd1", "password2", "qwerty12", "freedom"
]);

export const ERROR_MESSAGES: Record<string, string> = {
  DuplicateEmail: "Email is already in use",
  DuplicateUsername: "Username is already taken",
  InvalidPassword: "Password is invalid",
  PasswordMismatch: "Passwords do not match",
  InvalidEmail: "Please enter a valid email address",
  InvalidUsername: "Username must be 3-16 alphanumeric characters (underscore allowed)",
  LinkCodeExpired: "Link code expired (valid for 20 minutes)",
  InvalidCredentials: "Email or password is incorrect",
  NetworkError: "Network error. Please try again",
  ServerError: "Something went wrong. Please try again",
  RegistrationFailed: "Registration failed. Please check your information and try again"
};

export const SUCCESS_MESSAGES: Record<string, string> = {
  RegistrationComplete:
    "Account created successfully. Your link code is ready. Use it on the Minecraft server to link your account.",
  LinkCodeCopied: "Link code copied to clipboard."
};