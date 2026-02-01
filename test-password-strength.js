// Quick test to verify password strength calculation
// This mimics the logic from passwordValidator.ts

function calculatePasswordStrength(password) {
  if (!password) {
    return { score: 0, feedback: ['Password required'] };
  }

  let score = 0;
  const feedback = [];

  // Check length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Check variety
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLowercase && hasUppercase) {
    score += 1; // Mixed case
  }

  if (hasNumbers) {
    score += 0.5;
  }

  if (hasSymbols) {
    score += 0.5;
  }

  const finalScore = Math.ceil(score);
  
  return { 
    score: finalScore, 
    rawScore: score,
    feedback,
    hasLowercase,
    hasUppercase,
    hasNumbers,
    hasSymbols,
    length: password.length
  };
}

// Test 'TestPassword'
const result = calculatePasswordStrength('TestPassword');
console.log('Password: TestPassword');
console.log(JSON.stringify(result, null, 2));
console.log('Passes >= 2 check?', result.score >= 2);
