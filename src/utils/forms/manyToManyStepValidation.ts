import { FormStepDto } from '../../types/dtos/forms/FormModels';

export type ManyToManyStepIssueCode = 'missing-join-entity-type' | 'missing-join-fields';

export interface ManyToManyStepIssue {
    code: ManyToManyStepIssueCode;
    message: string;
}

export const getManyToManyStepIssues = (step: FormStepDto): ManyToManyStepIssue[] => {
    if (!step.isManyToManyRelationship) {
        return [];
    }

    const issues: ManyToManyStepIssue[] = [];

    if (!step.joinEntityType) {
        issues.push({
            code: 'missing-join-entity-type',
            message: 'Join entity type is required for many-to-many steps.'
        });
    }

    const hasJoinFieldSource = Boolean(step.subConfigurationId) || (step.childFormSteps?.length ?? 0) > 0;
    if (!hasJoinFieldSource) {
        issues.push({
            code: 'missing-join-fields',
            message: 'Provide join fields by adding child steps or linking a join entity form configuration.'
        });
    }

    return issues;
};
