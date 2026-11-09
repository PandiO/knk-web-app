import React from 'react';
import { act, render } from '@testing-library/react';
import {
  describeActors,
  isRelevantChange,
  LIVE_REFRESH_DEBOUNCE_MS,
  LiveChange,
  PresenceChangedPayload,
  useLiveEntityChanges,
  usePresenceChanges,
} from '../liveUpdates';
import { WEB_EVENT_TYPES } from '../RealtimeProvider';
import { fakeRealtime } from '../../test-utils/fakeRealtime';

/** PandiO/knk-workspace#183 (Realtime S4): the web app's live-update hooks. */

describe('isRelevantChange', () => {
  const change = { type: 'Town', id: 4, op: 'Updated', actorUserId: 7, actorName: 'alice' };

  it('matches the type ignoring case, and the entity when an id is given', () => {
    expect(isRelevantChange(change, 'town', null, 1)).toBe(true);
    expect(isRelevantChange(change, 'Town', 4, 1)).toBe(true);
    expect(isRelevantChange(change, 'Town', 5, 1)).toBe(false);
    expect(isRelevantChange(change, 'Street', null, 1)).toBe(false);
    expect(isRelevantChange(null, 'Town', null, 1)).toBe(false);
  });

  it('counts a change without an id (many at once) for every entity of the type', () => {
    expect(isRelevantChange({ ...change, id: null }, 'Town', 5, 1)).toBe(true);
  });

  it("skips the viewer's own change, not the game server's", () => {
    expect(isRelevantChange(change, 'Town', null, 7)).toBe(false);
    expect(isRelevantChange({ ...change, actorUserId: null, actorName: null }, 'Town', null, 7)).toBe(true);
  });
});

describe('describeActors', () => {
  it('names one, two or a few of them', () => {
    expect(describeActors([])).toBe('Updated');
    expect(describeActors(['alice'])).toBe('Updated by alice');
    expect(describeActors(['alice', 'bob'])).toBe('Updated by alice and bob');
    expect(describeActors(['alice', 'bob', 'carol'])).toBe('Updated by alice, bob and 1 other');
    expect(describeActors(['a', 'b', 'c', 'd'], 'Deleted')).toBe('Deleted by a, b and 2 others');
  });
});

it('the provider listens for EntityChanged and PresenceChanged', () => {
  expect(WEB_EVENT_TYPES).toEqual(expect.arrayContaining(['EntityChanged', 'PresenceChanged']));
});

const Watcher: React.FC<{ type: string | null; id?: number | null; onChange: (change: LiveChange) => void }> = ({ type, id, onChange }) => {
  useLiveEntityChanges(type, onChange, { id });
  return null;
};

describe('useLiveEntityChanges', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('gathers a burst from other staff into one call, with their names', () => {
    const hub = fakeRealtime({ userId: 1 });
    const onChange = jest.fn();
    render(<hub.Provider><Watcher type="Town" onChange={onChange} /></hub.Provider>);

    act(() => {
      hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Updated', actorUserId: 7, actorName: 'alice' }, 7);
      hub.emit('EntityChanged', { type: 'Town', id: 5, op: 'Created', actorUserId: 8, actorName: 'bob' }, 8);
      hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Updated', actorUserId: 7, actorName: 'alice' }, 7);
      hub.emit('EntityChanged', { type: 'Street', id: 1, op: 'Updated', actorUserId: 7, actorName: 'alice' }, 7);
      hub.emit('EntityChanged', { type: 'Town', id: 6, op: 'Updated', actorUserId: 1, actorName: 'me' }, 1);
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ actors: ['alice', 'bob'], deleted: false, reconnect: false });
  });

  it('ignores your own change entirely', () => {
    const hub = fakeRealtime({ userId: 7 });
    const onChange = jest.fn();
    render(<hub.Provider><Watcher type="Town" onChange={onChange} /></hub.Provider>);

    act(() => {
      hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Updated', actorUserId: 7, actorName: 'alice' }, 7);
      jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS * 2);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tells a watched entity it was deleted, and re-reads after a reconnect', () => {
    const hub = fakeRealtime({ userId: 1 });
    const onChange = jest.fn();
    render(<hub.Provider><Watcher type="Town" id={4} onChange={onChange} /></hub.Provider>);

    act(() => {
      hub.emit('EntityChanged', { type: 'Town', id: 9, op: 'Deleted', actorUserId: 7, actorName: 'alice' }, 7);
      jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS);
    });
    expect(onChange).not.toHaveBeenCalled(); // another town

    act(() => {
      hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Deleted', actorUserId: 7, actorName: 'alice' }, 7);
      jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS);
    });
    expect(onChange).toHaveBeenLastCalledWith({ actors: ['alice'], deleted: true, reconnect: false });

    act(() => {
      hub.reconnect();
      jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS);
    });
    expect(onChange).toHaveBeenLastCalledWith({ actors: [], deleted: false, reconnect: true });
  });

  it('watches nothing without a type, and drops a pending call on unmount', () => {
    const hub = fakeRealtime();
    const onChange = jest.fn();
    const { rerender, unmount } = render(<hub.Provider><Watcher type={null} onChange={onChange} /></hub.Provider>);
    act(() => {
      hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Updated' });
      hub.reconnect();
      jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS);
    });
    expect(onChange).not.toHaveBeenCalled();

    rerender(<hub.Provider><Watcher type="Town" onChange={onChange} /></hub.Provider>);
    act(() => { hub.emit('EntityChanged', { type: 'Town', id: 4, op: 'Updated' }); });
    unmount();
    act(() => { jest.advanceTimersByTime(LIVE_REFRESH_DEBOUNCE_MS); });
    expect(onChange).not.toHaveBeenCalled();
    expect(hub.listeners('EntityChanged')).toBe(0);
  });
});

describe('usePresenceChanges', () => {
  const Presence: React.FC<{ onChange: (change: PresenceChangedPayload | null) => void }> = ({ onChange }) => {
    usePresenceChanges(onChange);
    return null;
  };

  it('passes each change on, and null after a reconnect', () => {
    const hub = fakeRealtime();
    const onChange = jest.fn();
    render(<hub.Provider><Presence onChange={onChange} /></hub.Provider>);

    act(() => hub.emit('PresenceChanged', { userId: 5, online: true, serverId: 'survival' }));
    expect(onChange).toHaveBeenLastCalledWith({ userId: 5, online: true, serverId: 'survival' });

    act(() => hub.reconnect());
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('without a hub nothing arrives', () => {
    const onChange = jest.fn();
    render(<Presence onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
