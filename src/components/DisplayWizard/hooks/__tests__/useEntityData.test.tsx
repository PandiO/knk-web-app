import { act, renderHook, waitFor } from '@testing-library/react';
import { useEntityData } from '../useEntityData';
import { getFetchByIdFunctionForEntity } from '../../../../utils/entityApiMapping';

/** PandiO/knk-workspace#183: a quiet re-read (live update) keeps the entity on screen. */

jest.mock('../../../../utils/entityApiMapping', () => ({ getFetchByIdFunctionForEntity: jest.fn() }));

const fetchById = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    (getFetchByIdFunctionForEntity as jest.Mock).mockReturnValue(fetchById);
});

it('keeps the data and shows no loading while a quiet re-read runs, and a failed one changes nothing', async () => {
    fetchById.mockResolvedValueOnce({ id: 4, name: 'Cinix' });
    const { result } = renderHook(() => useEntityData('Town', 4));
    await waitFor(() => expect(result.current.data).toEqual({ id: 4, name: 'Cinix' }));

    let answer: (value: unknown) => void = () => undefined;
    fetchById.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.refetch(true); });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ id: 4, name: 'Cinix' });
    await act(async () => { answer({ id: 4, name: 'Cinix II' }); await pending; });
    expect(result.current.data).toEqual({ id: 4, name: 'Cinix II' });

    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchById.mockRejectedValueOnce(new Error('gone'));
    await act(async () => { await result.current.refetch(true); });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ id: 4, name: 'Cinix II' });
    errors.mockRestore();
});
