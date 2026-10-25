import { useEffect, useState } from 'react';
import { authClient } from '../apiClients/authClient';
import { OnboardingInfo, RegistrationMode } from '../types/dtos/auth/AuthDtos';
import { readOnboardingInfo, registerOnboardingInfoLoader, writeOnboardingInfo } from '../utils/onboardingInfoCache';

/**
 * What the onboarding pages need from the API (GET Auth/onboarding-info, anonymous), asked once per
 * page load and shared by every component: the registration mode (under Invite a new player signs up
 * with an invitation, so the link-code register form alone can't succeed and the register and login
 * pages send newcomers to /join, /link or /invite), whether the Cloudflare Access step applies
 * (then every flow explains the one-time code and a missing Access session is recognised), and the
 * public base URL. Found on the alpha 2026-10-25: two testers stuck on /auth/register and in front
 * of "Network error" with no Cloudflare session.
 */
export interface OnboardingInfoState {
  /** The answer, or null while it is being fetched or when the API couldn't be asked. */
  info: OnboardingInfo | null;
  /** True until the first answer (or failure) is in. */
  loading: boolean;
  /** The mode, or null while unknown. */
  mode: RegistrationMode | null;
  /** New accounts need an invitation (Invite or Open). False while unknown: the page then behaves as before. */
  inviteSignup: boolean;
  /** The site sits behind Cloudflare Access: show the one-time code instructions. False while unknown. */
  accessGate: boolean;
}

const KNOWN_MODES: readonly RegistrationMode[] = ['LinkCode', 'Invite', 'Open'];

let inFlight: Promise<OnboardingInfo | null> | null = null;

function asMode(value: unknown): RegistrationMode | null {
  return KNOWN_MODES.includes(value as RegistrationMode) ? (value as RegistrationMode) : null;
}

/**
 * The info, from the cache or the API. A failed call isn't cached: the next caller asks again. (A
 * failure on a page behind Access means the player already has a session, so "no Cloudflare step".)
 */
export function fetchOnboardingInfo(): Promise<OnboardingInfo | null> {
  const cached = readOnboardingInfo();
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = authClient.onboardingInfo()
      .then(dto => {
        const mode = asMode(dto?.registrationMode);
        if (!mode) return null;
        const info: OnboardingInfo = {
          registrationMode: mode,
          accessGate: dto.accessGate === true,
          publicBaseUrl: typeof dto.publicBaseUrl === 'string' ? dto.publicBaseUrl : '',
        };
        writeOnboardingInfo(info);
        return info;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

// The service-call layer asks through the cache module (no import cycle: it can't import this file).
registerOnboardingInfoLoader(fetchOnboardingInfo);

/** Invite and Open both mean "sign up with an invitation" (DESIGN.md § 6, L3-1). */
export function isInviteSignup(mode: RegistrationMode | null): boolean {
  return mode === 'Invite' || mode === 'Open';
}

/** Tests only: forget the cached answer. */
export function resetOnboardingInfoCache(): void {
  writeOnboardingInfo(null);
  inFlight = null;
}

function toState(info: OnboardingInfo | null, loading: boolean): OnboardingInfoState {
  const mode = info?.registrationMode ?? null;
  return { info, loading, mode, inviteSignup: isInviteSignup(mode), accessGate: info?.accessGate === true };
}

export function useOnboardingInfo(): OnboardingInfoState {
  const [info, setInfo] = useState<OnboardingInfo | null>(() => readOnboardingInfo());
  const [loading, setLoading] = useState(info === null);

  useEffect(() => {
    if (readOnboardingInfo()) return;
    let cancelled = false;
    fetchOnboardingInfo().then(result => {
      if (cancelled) return;
      setInfo(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return toState(info, loading);
}

/** The same, for code that only needs the mode. */
export function useRegistrationMode(): { mode: RegistrationMode | null; loading: boolean; inviteSignup: boolean } {
  const { mode, loading, inviteSignup } = useOnboardingInfo();
  return { mode, loading, inviteSignup };
}
