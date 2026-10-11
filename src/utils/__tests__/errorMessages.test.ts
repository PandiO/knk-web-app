import { resolveErrorMessage, words } from '../errorMessages';

describe('resolveErrorMessage', () => {
    it('uses the text from en-en.json when the key exists', () => {
        expect(resolveErrorMessage('ErrorMessage.FormConfiguration.LoadFailed')).toBe('Failed to load form configuration.');
    });

    it('turns a missing "<Verb>Failed" key into a readable sentence', () => {
        expect(resolveErrorMessage('ErrorMessage.Town.LoadFailed')).toBe('Could not load town.');
        expect(resolveErrorMessage('ErrorMessage.GameSettings.SaveFailed')).toBe('Could not save game settings.');
        expect(resolveErrorMessage('ErrorMessage.DisplayConfiguration.AddSectionFailed'))
            .toBe('Could not add section (display configuration).');
    });

    it('gives any other missing key a generic line instead of the raw key', () => {
        expect(resolveErrorMessage('ErrorMessage.Town.ClientNotFound'))
            .toBe('Something went wrong (town: client not found). Please try again.');
    });

    it('passes a ready message through', () => {
        expect(resolveErrorMessage('Step completion conditions not met')).toBe('Step completion conditions not met');
        expect(resolveErrorMessage(new Error('Boom'))).toBe('Boom');
    });

    it('never returns an empty message', () => {
        expect(resolveErrorMessage('')).toBe('Something went wrong. Please try again.');
        expect(resolveErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    });
});

describe('words', () => {
    it('splits identifiers and keeps acronyms', () => {
        expect(words('DisplayConfiguration')).toBe('display configuration');
        expect(words('UIConfigurations')).toBe('UI configurations');
    });
});
