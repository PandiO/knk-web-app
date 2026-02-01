import React from 'react';
import { Copy as CopyIcon, Link as LinkIcon } from 'lucide-react';

export type ReuseLinkMode = 'copy' | 'link';

interface Props {
    mode: ReuseLinkMode;
    onChange: (mode: ReuseLinkMode) => void;
}

export const LinkModeSelector: React.FC<Props> = ({ mode, onChange }) => {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                How to add this template:
            </label>
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => onChange('copy')}
                    className={`flex items-center gap-2 p-3 border rounded-lg text-sm font-medium transition-all ${
                        mode === 'copy'
                            ? 'border-primary bg-blue-50 text-primary'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                >
                    <CopyIcon className="h-4 w-4" />
                    <span>Copy</span>
                </button>
                <button
                    type="button"
                    onClick={() => onChange('link')}
                    className={`flex items-center gap-2 p-3 border rounded-lg text-sm font-medium transition-all ${
                        mode === 'link'
                            ? 'border-primary bg-blue-50 text-primary'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                >
                    <LinkIcon className="h-4 w-4" />
                    <span>Link</span>
                </button>
            </div>
            <p className="text-xs text-gray-600">
                {mode === 'copy' 
                    ? 'Create an independent copy of this template that you can modify freely.' 
                    : 'Link to the template. Changes to the template will update here automatically.'}
            </p>
        </div>
    );
};
