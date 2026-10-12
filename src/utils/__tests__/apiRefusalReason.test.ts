import { apiRefusalReason } from '../apiRefusalReason';

const apiError = (status: number, message: string) => Object.assign(new Error(message), { status });

describe('apiRefusalReason', () => {
    it("returns the API's explanation of a refusal", () => {
        const reason = "This form configuration can't be deleted: it is still used by 3 form sessions started with it.";
        expect(apiRefusalReason(apiError(409, reason))).toBe(reason);
        expect(apiRefusalReason(apiError(400, 'Invalid id.'))).toBe('Invalid id.');
    });

    it('has a plain reason for a 403 without a message', () => {
        expect(apiRefusalReason(apiError(403, 'HTTP 403: Forbidden'))).toBe("You don't have permission to do this.");
    });

    it('gives nothing for a bare status, a server error or a network error', () => {
        expect(apiRefusalReason(apiError(409, 'HTTP 409: Conflict'))).toBeUndefined();
        expect(apiRefusalReason(apiError(500, 'Something broke'))).toBeUndefined();
        expect(apiRefusalReason(new Error('Failed to fetch'))).toBeUndefined();
        expect(apiRefusalReason(null)).toBeUndefined();
    });
});
