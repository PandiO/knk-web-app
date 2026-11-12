import React from 'react';
import { ChatTokenSettingsDto } from '../../../types/dtos/gameSettings/GameSettingsModels';

/** The API's upper bounds (ChatTokenSettingsDto in knk-web-api). */
export const MAX_TOKENS_PER_MESSAGE_LIMIT = 20;
export const MAX_STAT_COOLDOWN_SECONDS = 3600;

/** Both limits off, as the API stores them until someone sets them. */
export const defaultChatTokenSettings = (): ChatTokenSettingsDto => ({ maxTokensPerMessage: 0, statCooldownSeconds: 0 });

/** A whole number in [0, max]; anything else (empty, negative, text) becomes 0 = off. */
export const clampLimit = (raw: string, max: number): number => {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n <= 0) {
        return 0;
    }
    return Math.min(n, max);
};

interface ChatTokensCardProps {
    value: ChatTokenSettingsDto;
    onChange: (value: ChatTokenSettingsDto) => void;
}

/**
 * Chat hashtag tokens (PandiO/knk-workspace#233): players type #hand, #kills, #kills@Steve, … in chat and the
 * plugin shows a hoverable value. This card holds the two anti-spam limits; both are off (0) by default.
 */
export const ChatTokensCard: React.FC<ChatTokensCardProps> = ({ value, onChange }) => (
    <div className="bg-surface shadow-sm rounded-lg p-6 border border-line space-y-3">
        <h2 className="text-lg font-semibold text-fg">Chat Tokens</h2>
        <p className="text-sm text-muted">
            Players can type <code>#hand</code>, <code>#stats</code>, <code>#kills</code>, <code>#kills@Steve</code> and
            {' '}more in chat, private messages and staff chat; <code>#tokens</code> lists them in game. These limits stop
            spam. <strong>0 = off</strong> (the default). Players with <code>knk.chat.token.bypass</code> skip both.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="chat-tokens-max" className="block text-sm font-medium text-fg mb-1">
                    Most tokens per message
                </label>
                <input
                    id="chat-tokens-max"
                    type="number"
                    min={0}
                    max={MAX_TOKENS_PER_MESSAGE_LIMIT}
                    value={value.maxTokensPerMessage}
                    onChange={e => onChange({ ...value, maxTokensPerMessage: clampLimit(e.target.value, MAX_TOKENS_PER_MESSAGE_LIMIT) })}
                    className="input px-3 py-2"
                />
                <p className="mt-1 text-xs text-muted">
                    Later tokens stay plain text. 0 = no limit, at most {MAX_TOKENS_PER_MESSAGE_LIMIT}.
                </p>
            </div>
            <div>
                <label htmlFor="chat-tokens-cooldown" className="block text-sm font-medium text-fg mb-1">
                    Cooldown for statistics tokens (seconds)
                </label>
                <input
                    id="chat-tokens-cooldown"
                    type="number"
                    min={0}
                    max={MAX_STAT_COOLDOWN_SECONDS}
                    value={value.statCooldownSeconds}
                    onChange={e => onChange({ ...value, statCooldownSeconds: clampLimit(e.target.value, MAX_STAT_COOLDOWN_SECONDS) })}
                    className="input px-3 py-2"
                />
                <p className="mt-1 text-xs text-muted">
                    Time between two messages with statistics tokens (<code>#stats</code>, <code>#kills</code>, …);
                    {' '}item and location tokens have none. 0 = no cooldown, at most {MAX_STAT_COOLDOWN_SECONDS}.
                </p>
            </div>
        </div>
    </div>
);
