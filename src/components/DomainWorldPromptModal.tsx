import React, { useEffect, useState } from 'react';
import { Globe2, X } from 'lucide-react';
import { gameSettingsClient } from '../apiClients/gameSettingsClient';

interface DomainWorldPromptModalProps {
    open: boolean;
    entityLabel: string;
    onConfirm: (worldName: string) => void;
    onCancel: () => void;
}

/**
 * KNG-111: asks which Minecraft world a domain is in, when neither its region world task, its Location nor its parent
 * gives one. Offers the worlds the game server last reported (Game Settings), or free text when none are known.
 */
export const DomainWorldPromptModal: React.FC<DomainWorldPromptModalProps> = ({ open, entityLabel, onConfirm, onCancel }) => {
    const [worlds, setWorlds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState('');

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setSelected('');
        gameSettingsClient.get()
            .then(settings => {
                if (cancelled) return;
                const names = (settings?.runtimeWorlds ?? [])
                    .map(world => world.worldName)
                    .filter((name): name is string => typeof name === 'string' && name.trim() !== '');
                setWorlds(names);
                if (names.length === 1) setSelected(names[0]);
            })
            .catch(() => {
                if (!cancelled) setWorlds([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    if (!open) return null;

    const trimmed = selected.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onCancel}>
            <div
                role="dialog"
                aria-label="Choose the world"
                className="w-full max-w-md rounded-lg shadow-lg border border-blue-100 bg-white relative"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between px-5 py-4">
                    <div className="flex items-start space-x-3">
                        <Globe2 className="h-6 w-6 text-blue-600" />
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Which world is this {entityLabel} in?</h3>
                            <p className="mt-1 text-sm text-gray-700">
                                Neither its region, its location nor its parent tells the world. Choose the Minecraft world
                                it belongs to.
                            </p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-5 pb-2">
                    {loading ? (
                        <p className="text-sm text-gray-500">Loading worlds...</p>
                    ) : worlds.length > 0 ? (
                        <fieldset className="space-y-2">
                            <legend className="sr-only">World</legend>
                            {worlds.map(world => (
                                <label key={world} className="flex items-center space-x-2 text-sm text-gray-800">
                                    <input
                                        type="radio"
                                        name="domain-world"
                                        value={world}
                                        checked={selected === world}
                                        onChange={() => setSelected(world)}
                                    />
                                    <span>{world}</span>
                                </label>
                            ))}
                        </fieldset>
                    ) : (
                        <label className="block text-sm text-gray-800">
                            <span>World name</span>
                            <input
                                type="text"
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                                maxLength={64}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                placeholder="e.g. world"
                            />
                            <span className="mt-1 block text-xs text-gray-500">
                                The game server hasn't reported its worlds yet.
                            </span>
                        </label>
                    )}
                </div>
                <div className="px-5 py-4 flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => trimmed && onConfirm(trimmed)}
                        disabled={!trimmed}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md disabled:opacity-50"
                    >
                        Use this world
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DomainWorldPromptModal;
