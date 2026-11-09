import React, { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { Dialog } from './Dialog';
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
                // KNG-118: several game servers can report the same world name; list it once.
                const names = Array.from(new Set((settings?.runtimeWorlds ?? [])
                    .map(world => world.worldName)
                    .filter((name): name is string => typeof name === 'string' && name.trim() !== '')));
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
        <Dialog
            open
            onClose={onCancel}
            title={`Which world is this ${entityLabel} in?`}
            description="Neither its region, its location nor its parent tells the world. Choose the Minecraft world it belongs to."
            icon={<Globe2 className="h-6 w-6 text-info" />}
            size="md"
            footer={
                <>
                    <button type="button" onClick={onCancel} className="btn-secondary">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => trimmed && onConfirm(trimmed)}
                        disabled={!trimmed}
                        className="btn-primary"
                    >
                        Use this world
                    </button>
                </>
            }
        >
            {loading ? (
                <p className="text-sm text-muted" role="status">Loading worlds...</p>
            ) : worlds.length > 0 ? (
                <fieldset className="space-y-2">
                    <legend className="sr-only">World</legend>
                    {worlds.map(world => (
                        <label key={world} className="flex items-center space-x-2 text-sm text-fg">
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
                <label className="block text-sm text-fg">
                    <span>World name</span>
                    <input
                        type="text"
                        value={selected}
                        onChange={e => setSelected(e.target.value)}
                        maxLength={64}
                        className="input mt-1 px-3 py-2"
                        placeholder="e.g. world"
                    />
                    <span className="mt-1 block text-xs text-muted">
                        The game server hasn't reported its worlds yet.
                    </span>
                </label>
            )}
        </Dialog>
    );
};

export default DomainWorldPromptModal;
