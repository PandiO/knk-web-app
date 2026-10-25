import { useEffect, useState } from 'react';
import { authClient } from '../apiClients/authClient';
import { RegistrationMode } from '../types/dtos/auth/AuthDtos';

/**
 * Security:Registration:Mode, asked of the API once per page load (GET Auth/registration-info,
 * anonymous) and shared by every component that needs it. Under Invite (and Open) a new player
 * signs up with an invitation, so the link-code register form alone can't succeed: the register
 * and login pages use this to send newcomers to /join, /link or /invite instead (found on the alpha
 * 2026-10-25, a tester stuck on /auth/register).
 */
export interface RegistrationModeState {
  /** The mode, or null while it is being fetched or when the API couldn't be asked. */
  mode: RegistrationMode | null;
  /** True until the first answer (or failure) is in. */
  loading: boolean;
  /** New accounts need an invitation (Invite or Open). False while unknown: the page then behaves as before. */
  inviteSignup: boolean;
}

const KNOWN_MODES: readonly RegistrationMode[] = ['LinkCode', 'Invite', 'Open'];

let cached: RegistrationMode | null = null;
let inFlight: Promise<RegistrationMode | null> | null = null;

function asMode(value: unknown): RegistrationMode | null {
  return KNOWN_MODES.includes(value as RegistrationMode) ? (value as RegistrationMode) : null;
}

/** The mode, from the cache or the API. A failed call isn't cached: the next caller asks again. */
export function fetchRegistrationMode(): Promise<RegistrationMode | null> {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = authClient.registrationInfo()
      .then(info => {
        cached = asMode(info?.mode);
        return cached;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Invite and Open both mean "sign up with an invitation" (DESIGN.md § 6, L3-1). */
export function isInviteSignup(mode: RegistrationMode | null): boolean {
  return mode === 'Invite' || mode === 'Open';
}

/** Tests only: forget the cached answer. */
export function resetRegistrationModeCache(): void {
  cached = null;
  inFlight = null;
}

export function useRegistrationMode(): RegistrationModeState {
  const [mode, setMode] = useState<RegistrationMode | null>(cached);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    fetchRegistrationMode().then(result => {
      if (cancelled) return;
      setMode(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { mode, loading, inviteSignup: isInviteSignup(mode) };
}
