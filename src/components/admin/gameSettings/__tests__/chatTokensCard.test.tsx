import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatTokensCard, clampLimit, defaultChatTokenSettings } from '../ChatTokensCard';

describe('ChatTokensCard (PandiO/knk-workspace#233)', () => {
    it('defaults both limits to 0 = off', () => {
        expect(defaultChatTokenSettings()).toEqual({ maxTokensPerMessage: 0, statCooldownSeconds: 0 });
    });

    it('clamps to a whole number in [0, max]; empty or negative is off', () => {
        expect(clampLimit('', 20)).toBe(0);
        expect(clampLimit('-3', 20)).toBe(0);
        expect(clampLimit('abc', 20)).toBe(0);
        expect(clampLimit('2.7', 20)).toBe(2);
        expect(clampLimit('99', 20)).toBe(20);
        expect(clampLimit('10', 3600)).toBe(10);
    });

    it('reports each field change', () => {
        const onChange = jest.fn();
        render(<ChatTokensCard value={{ maxTokensPerMessage: 0, statCooldownSeconds: 0 }} onChange={onChange} />);

        fireEvent.change(screen.getByLabelText('Most tokens per message'), { target: { value: '3' } });
        expect(onChange).toHaveBeenLastCalledWith({ maxTokensPerMessage: 3, statCooldownSeconds: 0 });

        fireEvent.change(screen.getByLabelText('Cooldown for statistics tokens (seconds)'), { target: { value: '10' } });
        expect(onChange).toHaveBeenLastCalledWith({ maxTokensPerMessage: 0, statCooldownSeconds: 10 });
    });
});
