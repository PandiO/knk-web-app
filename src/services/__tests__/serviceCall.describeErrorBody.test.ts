import { describeErrorBody } from '../serviceCall';

describe('describeErrorBody', () => {
    it('uses a plain-text body (BadRequest(ex.Message))', () => {
        expect(describeErrorBody('A team without a clan needs a name, a chat colour and a banner.', 400, 'Bad Request'))
            .toBe('A team without a clan needs a name, a chat colour and a banner.');
    });

    it('uses message, detail, the first validation error, then title of a JSON body', () => {
        expect(describeErrorBody({ code: 'BusinessRuleViolation', message: 'Key already used.' }, 409, 'Conflict')).toBe('Key already used.');
        expect(describeErrorBody({ title: 'Bad', detail: 'Detail text' }, 400, 'Bad Request')).toBe('Detail text');
        expect(describeErrorBody({ title: 'One or more validation errors occurred.', errors: { Name: ['The Name field is required.'] } }, 400, 'Bad Request'))
            .toBe('The Name field is required.');
        expect(describeErrorBody({ title: 'Not Found' }, 404, 'Not Found')).toBe('Not Found');
    });

    it('falls back to the status for empty, HTML or unknown bodies', () => {
        expect(describeErrorBody(null, 500, 'Internal Server Error')).toBe('HTTP 500: Internal Server Error');
        expect(describeErrorBody('   ', 400, 'Bad Request')).toBe('HTTP 400: Bad Request');
        expect(describeErrorBody('<html>oops</html>', 502, 'Bad Gateway')).toBe('HTTP 502: Bad Gateway');
    });
});
