import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

/** The catch-all route: an unknown path. */
export const NotFoundPage: React.FC = () => {
  usePageTitle('Page not found');
  return (
    <main className="max-w-md mx-auto mt-16 bg-white shadow-sm rounded-lg border border-gray-200 p-8 text-center">
      <Compass className="h-10 w-10 mx-auto text-gray-400" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="mt-2 text-sm text-gray-600">
        There's nothing at this address. It may have moved, or the link is mistyped.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" className="btn-primary inline-flex justify-center">Go home</Link>
        <Link to="/account" className="btn-secondary inline-flex justify-center">
          Your account
        </Link>
      </div>
    </main>
  );
};
