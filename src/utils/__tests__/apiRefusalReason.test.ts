import { apiRefusalReason, failureReason } from '../apiRefusalReason';

const apiError = (status: number, message: string) => Object.assign(new Error(message), { status });

describe('apiRefusalReason', () => {
    it("returns the API's explanation of a refusal", () => {
        const reason = "This form configuration can't be deleted: it is still used by 3 form sessions started with it.";
        expect(apiRefusalReason(apiError(409, reason))).toBe(reason);
        expect(apiRefusalReason(apiError(400, 'Invalid id.'))).toBe('Invalid id.');
    });

    it("prefers the response body's text or message", () => {
        const withBody = (status: number, response: unknown) => Object.assign(new Error(`HTTP ${status}: Bad Request`), { status, response });
        expect(apiRefusalReason(withBody(400, 'MaxBoxStars must be 1-5.'))).toBe('MaxBoxStars must be 1-5.');
        expect(apiRefusalReason(withBody(409, { error: 'InUse', message: 'Still used by 2 towns.' }))).toBe('Still used by 2 towns.');
        expect(apiRefusalReason(withBody(400, '<html>Bad Request</html>'))).toBeUndefined();
    });

    it('has a plain reason for a 403 without a message', () => {
        expect(apiRefusalReason(apiError(403, 'HTTP 403: Forbidden'))).toBe("You don't have permission to do this.");
    });

    it("shows a server error's message only when the API answered it deliberately ({ error, message })", () => {
        const serverError = (status: number, response: unknown) => Object.assign(new Error('x'), { status, response });
        expect(apiRefusalReason(serverError(502, { error: 'EmailFailed', message: 'The confirmation email could not be sent.' })))
            .toBe('The confirmation email could not be sent.');
        expect(apiRefusalReason(serverError(500, { message: 'An error occurred while retrieving configurations.' }))).toBeUndefined();
        expect(apiRefusalReason(serverError(500, 'Object reference not set to an instance of an object.'))).toBeUndefined();
    });

    it('gives nothing for a bare status, a server error or a network error', () => {
        expect(apiRefusalReason(apiError(409, 'HTTP 409: Conflict'))).toBeUndefined();
        expect(apiRefusalReason(apiError(500, 'Something broke'))).toBeUndefined();
        expect(apiRefusalReason(new Error('Failed to fetch'))).toBeUndefined();
        expect(apiRefusalReason(null)).toBeUndefined();
    });
});

describe('failureReason', () => {
    it("is the API's refusal reason for a response", () => {
        expect(failureReason(apiError(409, 'Still used by 2 towns.'))).toBe('Still used by 2 towns.');
        expect(failureReason(apiError(500, 'Something broke'))).toBeUndefined();
        expect(failureReason(apiError(409, 'HTTP 409: Conflict'))).toBeUndefined();
    });

    it("is the app's own error message, but not a timeout or a network failure", () => {
        expect(failureReason(new Error('The join entity has no foreign key to Town.'))).toBe('The join entity has no foreign key to Town.');
        expect(failureReason(new Error('promise timeout'))).toBeUndefined();
        expect(failureReason(new TypeError('Failed to fetch'))).toBeUndefined();
        expect(failureReason('boom')).toBeUndefined();
    });
});
