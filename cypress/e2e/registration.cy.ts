/**
 * E2E: registration with a link code from the game server (alpha hardening WP9.4, decision D1).
 *
 * 1. The player enters the code from `/account link`; the app shows whose Minecraft account it is.
 * 2. They pick an email and a password.
 * 3. The API logs them in (login-shaped response) and the app lands on /account.
 *
 * The API is stubbed with cy.intercept, so this runs against `npm start` alone.
 */

const user = {
  id: 42,
  uuid: '00000000-0000-0000-0000-000000000042',
  username: 'Steve',
  email: 'steve@example.com',
  emailVerified: false,
  accountCreatedVia: 1,
  isActive: true,
  coins: 0,
  gems: 0,
  experiencePoints: 0,
  createdAt: new Date().toISOString(),
};
const password = 'Kn1ghts&Kings!';

describe('Registration with a link code', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/Users/validate-link-code/ABCD1234', { isValid: true, username: 'Steve' }).as('validate');
    cy.intercept('POST', '**/api/Users/validate-link-code/BADC0DE1', { isValid: false, error: 'Invalid or expired link code' });
    cy.visit('/auth/register');
  });

  it('rejects an invalid code', () => {
    cy.get('[data-testid=link-code]').type('badc-0de1');
    cy.contains('button', 'Check code').click();
    cy.contains('This code is invalid or has expired').should('be.visible');
  });

  it('registers and lands on the account page', () => {
    cy.intercept('POST', '**/api/Auth/register', {
      statusCode: 201,
      body: { accessToken: 'access-token', refreshToken: null, expiresIn: 1800, user },
    }).as('register');
    cy.intercept('GET', '**/api/Auth/me', user);
    cy.intercept('GET', '**/api/Users/42/permissions/check*', { statusCode: 403, body: { error: 'Forbidden' } });

    cy.get('[data-testid=link-code]').type('abcd1234');
    cy.contains('button', 'Check code').click();
    cy.wait('@validate');
    cy.contains('This code belongs to Steve').should('be.visible');

    cy.get('[data-testid=email]').type(user.email);
    cy.get('[data-testid=password]').type(password);
    cy.get('[data-testid=confirm-password]').type(password);
    cy.contains('button', 'Create account').click();

    cy.wait('@register').its('request.body').should('deep.equal', {
      linkCode: 'ABCD1234',
      email: user.email,
      password,
      passwordConfirmation: password,
    });
    cy.contains('Your web account is ready').should('be.visible');
    cy.location('pathname', { timeout: 6000 }).should('eq', '/account');
  });

  it('shows a duplicate email on the email field', () => {
    cy.intercept('POST', '**/api/Auth/register', {
      statusCode: 409,
      body: { error: 'DuplicateEmail', message: 'Email is already in use.' },
    });

    cy.get('[data-testid=link-code]').type('ABCD1234');
    cy.contains('button', 'Check code').click();
    cy.get('[data-testid=email]').type(user.email);
    cy.get('[data-testid=password]').type(password);
    cy.get('[data-testid=confirm-password]').type(password);
    cy.contains('button', 'Create account').click();

    cy.get('#email-error').should('contain', 'already used by another account');
  });
});
