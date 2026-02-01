import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface LinkCodeDisplayProps {
  code: string;
  expiresAt?: string;
  onCopySuccess?: () => void;
}

/**
 * Displays a link code in a visually prominent way with copy functionality
 * Used on registration success page and account linking flows
 * WCAG 2.1 Level AA accessible with keyboard support and screen reader announcements
 */
export const LinkCodeDisplay: React.FC<LinkCodeDisplayProps> = ({
  code,
  expiresAt,
  onCopySuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyAnnouncement, setCopyAnnouncement] = useState('');

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setCopyAnnouncement(`Link code ${code} copied to clipboard`);
      onCopySuccess?.();
      // Reset copied state after 2 seconds
      const timer = setTimeout(() => {
        setCopied(false);
        setCopyAnnouncement('');
      }, 2000);
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Failed to copy code:', error);
      setCopyAnnouncement('Failed to copy code. Please try again.');
      setCopied(false);
    }
  };

  // Calculate expiry time remaining
  const getExpiryMessage = () => {
    if (!expiresAt) return null;
    
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'This code has expired';
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
      return 'Expires in less than a minute';
    }
    
    return `Expires in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {copyAnnouncement}
      </div>

      {/* Code Display Box with responsive layout */}
      <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
        <p className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Your Link Code
        </p>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-3xl sm:text-4xl font-bold text-gray-900 font-mono tracking-wider break-words overflow-wrap-anywhere">
              {code || 'CODE_UNAVAILABLE'}
            </p>
          </div>
          
          <button
            onClick={handleCopy}
            disabled={!code}
            className={`flex items-center gap-2 px-4 py-2 sm:py-3 rounded-lg font-medium transition-all flex-shrink-0 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary w-full sm:w-auto justify-center sm:justify-start ${
              copied
                ? 'bg-green-500 text-white'
                : code
                ? 'bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            aria-label={copied ? 'Code copied to clipboard!' : 'Copy link code to clipboard'}
            aria-pressed={copied}
          >
            {copied ? (
              <>
                <Check className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Expiry Info */}
        {expiresAt && (
          <p className="text-xs sm:text-sm text-gray-600" role="status">
            {getExpiryMessage()}
          </p>
        )}
        
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
          Use this code with the <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">/account link</code> command on the Minecraft server
        </p>
      </div>
    </div>
  );
};
