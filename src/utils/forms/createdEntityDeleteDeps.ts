import { formSubmissionClient } from '../../apiClients/formSubmissionClient';
import { getDeleteFunctionForEntity } from '../entityApiMapping';
import type { DeleteCreatedEntitiesDeps } from './deleteCreatedEntities';

/** KNG-162: the real API calls behind deleteCreatedEntities (reference check + each entity's normal delete). */
export const createdEntityDeleteDeps: DeleteCreatedEntitiesDeps = {
    checkReferences: (entityTypeName, id, ignore) => formSubmissionClient.getEntityReferences(entityTypeName, id, ignore),
    getDeleteFunction: entityTypeName => {
        try {
            return getDeleteFunctionForEntity(entityTypeName);
        } catch {
            return null;
        }
    }
};
