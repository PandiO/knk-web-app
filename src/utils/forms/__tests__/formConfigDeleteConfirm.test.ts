import { formConfigDeleteMessage, savedDraftCount } from '../formConfigDeleteConfirm';

const refs = (references: { referencedBy: string; count: number }[]) => ({
    entityTypeName: 'FormConfiguration', id: '20', inUse: references.length > 0, references
});

describe('form configuration delete confirm (KNG-172)', () => {
    it('counts the saved drafts among the references', () => {
        expect(savedDraftCount(refs([
            { referencedBy: 'FormStep.FormConfigurationId', count: 4 },
            { referencedBy: 'FormSubmissionProgress.FormConfigurationId', count: 3 }
        ]))).toBe(3);
        expect(savedDraftCount(refs([{ referencedBy: 'FormStep.FormConfigurationId', count: 4 }]))).toBe(0);
        expect(savedDraftCount(refs([]))).toBe(0);
        expect(savedDraftCount(null)).toBe(0);
        expect(savedDraftCount(undefined)).toBe(0);
    });

    it('says the drafts are deleted too', () => {
        expect(formConfigDeleteMessage('Town - Default', 3))
            .toBe('Are you sure you want to delete "Town - Default"? Its 3 saved drafts are deleted too.');
        expect(formConfigDeleteMessage('Town - Default', 1))
            .toBe('Are you sure you want to delete "Town - Default"? Its 1 saved draft is deleted too.');
    });

    it('without drafts it is the plain question', () => {
        expect(formConfigDeleteMessage('Town - Default', 0)).toBe('Are you sure you want to delete "Town - Default"?');
    });
});
