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
 */
export const LinkCodeDisplay: React.FC<LinkCodeDisplayProps> = ({
  code,
  expiresAt,
  onCopySuccess,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopySuccess?.();
      // Reset copied state after 2 seconds
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Failed to copy code:', error);
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
      {/* Code Display Box */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Your Link Code
        </p>
        
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex-1">
            <p className="text-4xl font-bold text-gray-900 font-mono tracking-wider">
              {code || 'CODE_UNAVAILABLE'}
            </p>
          </div>
          
          <button
            onClick={handleCopy}
            disabled={!code}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all flex-shrink-0 ${
              copied
                ? 'bg-green-500 text-white'
                : code
                ? 'bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            aria-label={copied ? 'Code copied!' : 'Copy code to clipboard'}
          >
            {copied ? (
              <>
                <Check className="h-5 w-5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Expiry Info */}
        {expiresAt && (
          <p className="text-xs text-gray-600">
            {getExpiryMessage()}
          </p>
        )}
        
        <p className="text-xs text-gray-600 mt-2">
          Use this code with the /account link command on the Minecraft server
        </p>
      </div>
    </div>
  );
};
