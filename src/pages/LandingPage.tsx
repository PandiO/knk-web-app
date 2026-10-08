import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { Slideshow } from '../components/Slideshow';
import { useAuth } from '../contexts/AuthContext';
import { appConfig } from '../config/appConfig';
import { usePageTitle } from '../hooks/usePageTitle';

const SLIDES = [
  { id: '1', url: '/images/1.jpg', title: 'Cinix from the north-west gate' },
  { id: '2', url: '/images/2.jpg', title: 'Cinix from the south-west forest' },
  { id: '3', url: '/images/3.jpg', title: 'Cinix' },
  { id: '4', url: '/images/4.jpg', title: 'Cinix' },
  { id: '5', url: '/images/5.jpg', title: 'Cinix' },
  { id: '6', url: '/images/6.jpg', title: 'Cinix' },
  { id: '7', url: '/images/7.jpg', title: 'Cinix' },
  { id: '8', url: '/images/8.jpg', title: 'Cinix' },
  { id: '9', url: '/images/9.jpg', title: 'Cinix' },
].map(slide => ({ ...slide, url: `${process.env.PUBLIC_URL}${slide.url}` }));

type CopyState = 'idle' | 'copied' | 'failed';

/** The Minecraft server address with a Copy button and a screen-reader status. */
export const ServerAddress: React.FC<{ address: string }> = ({ address }) => {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(address);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState('idle'), 2500);
  };

  return (
    <div className="inline-flex flex-col items-center">
      <span className="text-xs font-semibold uppercase tracking-wider text-white/70" id="server-address-label">
        Server address
      </span>
      <div className="mt-1 flex items-center gap-2 rounded-lg bg-black/60 px-4 py-2 ring-1 ring-white/20">
        <code className="font-mono text-lg sm:text-xl text-white select-all" aria-labelledby="server-address-label">
          {address}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label={`Copy server address ${address}`}
        >
          {copyState === 'copied' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copyState === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <span role="status" aria-live="polite" className={copyState === 'failed' ? 'mt-1 text-sm text-amber-200' : 'sr-only'}>
        {copyState === 'copied' && 'Copied'}
        {copyState === 'failed' && 'Copying failed. Select the address and copy it yourself.'}
      </span>
    </div>
  );
};

const JOIN_STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Join the server',
    body: <>Open Minecraft Java Edition and add the server address above.</>,
  },
  {
    title: 'Get your code',
    body: <>Type <code className="rounded bg-white/15 px-1 font-mono">/account link</code> in chat. You get an 8-character code.</>,
  },
  {
    title: 'Register here',
    body: <>Enter the code on the register page and pick an email and a password.</>,
  },
];

export function LandingPage() {
  usePageTitle(null);
  const { isLoggedIn } = useAuth();
  const serverAddress = appConfig.minecraft.serverAddress;

  return (
    <div className="min-h-screen relative">
      {/* Background slideshow */}
      <div className="fixed inset-0">
        <Slideshow images={SLIDES} />
      </div>

      {/* Content overlay: clicks outside the content reach the slideshow controls. */}
      <div className="relative z-30 pointer-events-none">
        <div className="min-h-screen flex items-center justify-center py-12">
          <div className="pointer-events-auto text-center text-white px-4 max-w-3xl">
            <span className="inline-block rounded-full bg-amber-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-black">
              Closed alpha
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold drop-shadow-lg">
              Knights &amp; Kings
            </h1>
            <p className="mt-2 text-xl sm:text-2xl font-medium drop-shadow">
              A medieval-fantasy MMO on Minecraft
            </p>
            <p className="mt-4 text-base sm:text-lg text-white/90 max-w-2xl mx-auto drop-shadow">
              Build up a town with your friends, lay siege to your rivals' gates, and grow your character,
              clan and fortune over time.
            </p>

            <div className="mt-8">
              <ServerAddress address={serverAddress} />
            </div>

            <section className="mt-10 text-left" aria-labelledby="how-to-join">
              <h2 id="how-to-join" className="text-center text-lg font-semibold">How to join</h2>
              <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                {JOIN_STEPS.map((step, index) => (
                  <li key={step.title} className="rounded-lg bg-black/55 p-4 ring-1 ring-white/15">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-black" aria-hidden="true">
                        {index + 1}
                      </span>
                      <h3 className="font-semibold">{step.title}</h3>
                    </div>
                    <p className="mt-2 text-sm text-white/85">{step.body}</p>
                  </li>
                ))}
              </ol>
            </section>

            <div className="mt-8 flex flex-col items-center space-y-3 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-4">
              {isLoggedIn ? (
                <Link
                  to="/account"
                  className="inline-flex items-center px-6 py-3 rounded-md text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                >
                  Go to your account
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth/register"
                    className="inline-flex items-center px-6 py-3 rounded-md text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                  >
                    Create account
                  </Link>
                  <Link
                    to="/auth/login"
                    className="inline-flex items-center px-6 py-3 rounded-md text-lg font-medium text-white bg-black bg-opacity-40 hover:bg-opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-colors"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
            <p className="mt-6 text-xs text-white/70">
              The alpha is open to invited testers only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
