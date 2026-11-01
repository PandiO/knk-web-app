import { formValuesSnapshot, sameFormValues } from '../formValuesSnapshot';

// #109 (link 5 fix round): the form's unsaved-changes state compares values, not "was touched".

describe('formValuesSnapshot', () => {
    it('treats empty string, null, undefined and an empty list as the same empty value', () => {
        const opened = { 0: { Name: null, Description: undefined, Tags: [] }, 1: { Motto: null } };
        const typedAndCleared = { 0: { Name: '', Description: '', Tags: [] }, 1: { Motto: '' } };
        expect(sameFormValues('Town', opened, typedAndCleared)).toBe(true);
        expect(sameFormValues('Town', opened, { 0: {}, 1: {} })).toBe(true);
        expect(sameFormValues('Town', opened, {})).toBe(true);
    });

    it('sees a value on any step, also one that is not the current step', () => {
        const opened = { 0: { Name: null }, 1: { Motto: null } };
        expect(sameFormValues('Town', opened, { 0: { Name: 'Cinix' }, 1: { Motto: null } })).toBe(false);
        expect(sameFormValues('Town', opened, { 0: { Name: null }, 1: { Motto: 'Onward' } })).toBe(false);
    });

    it('compares a number with its text, objects whatever their key order, and keeps list positions', () => {
        expect(sameFormValues('Town', { 0: { Size: 5, Active: true } }, { 0: { Size: '5', Active: 'true' } })).toBe(true);
        expect(sameFormValues('Town', { 0: { Size: 5 } }, { 0: { Size: 6 } })).toBe(false);
        expect(sameFormValues('Town',
            { 0: { Location: { id: 3, x: 1, y: 2 } } },
            { 0: { Location: { y: 2, x: 1, id: 3, world: null } } })).toBe(true);
        expect(sameFormValues('Town',
            { 0: { Location: { id: 3, x: 1, y: 2 } } },
            { 0: { Location: { id: 3, x: 1, y: 9 } } })).toBe(false);
        expect(sameFormValues('Town', { 0: { Ids: [1, 2] } }, { 0: { Ids: [2, 1] } })).toBe(false);
        expect(sameFormValues('Town', { 0: { Ids: [1, null] } }, { 0: { Ids: [1] } })).toBe(false);
    });

    it('counts a value parked in the hidden stash as the form\'s value', () => {
        const opened = formValuesSnapshot('Town', { 0: { Kind: 'A', Extra: 'x' } });
        // A display condition hid Extra: its value moved to the stash, the step holds no copy (or an empty one).
        expect(formValuesSnapshot('Town', { 0: { Kind: 'A' } }, { 0: { Extra: 'x' } })).toBe(opened);
        expect(formValuesSnapshot('Town', { 0: { Kind: 'A', Extra: null } }, { 0: { Extra: 'x' } })).toBe(opened);
        expect(formValuesSnapshot('Town', { 0: { Kind: 'B' } }, { 0: { Extra: 'x' } })).not.toBe(opened);
    });
});
