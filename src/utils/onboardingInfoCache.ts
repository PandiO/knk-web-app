import { OnboardingInfo } from '../types/dtos/auth/AuthDtos';

/**
 * The per-page-load cache of GET Auth/onboarding-info. Its own module without imports, so the
 * service-call layer (which the API clients are built on) can read it without an import cycle:
 * `useOnboardingInfo` registers its loader here, and `loadOnboardingInfo` uses it.
 */
let cached: OnboardingInfo | null = null;
let loader: (() => Promise<OnboardingInfo | null>) | null = null;

export function readOnboardingInfo(): OnboardingInfo | null {
  return cached;
}

export function writeOnboardingInfo(info: OnboardingInfo | null): void {
  cached = info;
}

/** Called once by `useOnboardingInfo` when it is loaded (it is, by every onboarding page). */
export function registerOnboardingInfoLoader(fn: () => Promise<OnboardingInfo | null>): void {
  loader = fn;
}

/** The cached info, else what the registered loader fetches, else null (unknown). */
export function loadOnboardingInfo(): Promise<OnboardingInfo | null> {
  if (cached) return Promise.resolve(cached);
  return loader ? loader() : Promise.resolve(null);
}
