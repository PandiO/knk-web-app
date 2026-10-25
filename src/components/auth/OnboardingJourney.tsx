import React from 'react';
import { appConfig } from '../../config/appConfig';

interface OnboardingJourneyProps {
  /** The site sits behind Cloudflare Access: include the one-time code step. */
  accessGate: boolean;
  /** Which step the player is on (1-based), shown as current. */
  current?: number;
  /** The first step's wording differs per page ("Sign up here" vs "Enter your invitation code"). */
  firstStep?: React.ReactNode;
}

/**
 * The whole journey, so a new player knows what the next screen will be (2026-10-25: nobody expected
 * Cloudflare's page after sign-up). Shown on /invite, /join and /link; the Cloudflare step only when
 * the gate is on.
 */
export const OnboardingJourney: React.FC<OnboardingJourneyProps> = ({ accessGate, current = 1, firstStep }) => {
  const steps: React.ReactNode[] = [
    firstStep ?? <>Sign up here with your invitation: choose a password.</>,
  ];
  if (accessGate) {
    steps.push(
      <>
        <strong>Cloudflare</strong> protects this site. On the next screen it asks for your email and emails you a{' '}
        <strong>6-digit code</strong> (sender: Cloudflare, not Knights &amp; Kings; check spam). Enter it and you're
        in on this device for 30 days.
      </>,
    );
  }
  steps.push(
    <>
      Join <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">{appConfig.minecraft.serverAddress}</code>{' '}
      (Java or Bedrock). The server shows you a code on screen; enter it on <strong>Link your Minecraft account</strong>,
      then join again.
    </>,
  );
  return (
    <ol className="space-y-1 text-sm text-gray-700" data-testid="onboarding-journey" aria-label="What happens next">
      {steps.map((step, index) => (
        <li key={index} className={`flex gap-2 ${index + 1 === current ? 'font-medium text-gray-900' : ''}`}>
          <span className="w-5 flex-shrink-0 text-right">{index + 1}.</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
};
