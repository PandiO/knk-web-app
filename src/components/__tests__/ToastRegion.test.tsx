import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastRegion } from '../ToastRegion';
import { logging } from '../../utils';
import { toast } from '../../utils/toast';

describe('ToastRegion (X-1)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows what is sent to the error handler, readable even for a missing key', () => {
    render(<ToastRegion />);

    act(() => logging.errorHandler.next('ErrorMessage.Town.LoadFailed'));

    expect(screen.getByRole('status')).toHaveTextContent('Could not load town.');
  });

  it('shows a repeated message once', () => {
    render(<ToastRegion />);

    act(() => {
      logging.errorHandler.next('Server down');
      logging.errorHandler.next('Server down');
    });

    expect(screen.getAllByText('Server down')).toHaveLength(1);
  });

  it('can be dismissed, and goes away by itself', () => {
    jest.useFakeTimers();
    render(<ToastRegion />);

    act(() => {
      logging.errorHandler.next('First');
      logging.errorHandler.next('Second');
    });
    act(() => { screen.getAllByRole('button', { name: 'Dismiss' })[0].click(); });
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(8000); });
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });

  it('keeps at most four', () => {
    render(<ToastRegion />);

    act(() => ['a', 'b', 'c', 'd', 'e'].forEach(m => logging.errorHandler.next(m)));

    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.getByText('e')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(4);
  });

  it('shows a success toast next to an error with the same text, and drops it sooner (#177 link 1)', () => {
    jest.useFakeTimers();
    render(<ToastRegion />);

    act(() => {
      toast.success('Town created.');
      toast.error('Town created.');
    });
    const shown = screen.getAllByText('Town created.').map(text => text.closest('[data-kind]')?.getAttribute('data-kind'));
    expect(shown).toEqual(['success', 'error']);

    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getAllByText('Town created.')).toHaveLength(1);
    expect(screen.getByText('Town created.').closest('[data-kind]')).toHaveAttribute('data-kind', 'error');
  });

  it('shows info and warning toasts, each named by its kind for screen readers (#33)', () => {
    render(<ToastRegion />);

    act(() => {
      toast.info('Draft restored.');
      toast.warning('The game server is offline.');
    });

    expect(screen.getByText('Draft restored.').closest('[data-kind]')).toHaveAttribute('data-kind', 'info');
    expect(screen.getByText('The game server is offline.').closest('[data-kind]')).toHaveAttribute('data-kind', 'warning');
    expect(screen.getByRole('status')).toHaveTextContent('Information: Draft restored.');
    expect(screen.getByRole('status')).toHaveTextContent('Warning: The game server is offline.');
  });

  it('runs an action once and closes; an action keeps the toast for at least 10 s', () => {
    jest.useFakeTimers();
    const undo = jest.fn();
    render(<ToastRegion />);

    act(() => toast.success('Town deleted.', { action: { label: 'Undo', onClick: undo } }));
    act(() => { jest.advanceTimersByTime(9000); });
    expect(screen.getByText('Town deleted.')).toBeInTheDocument();

    act(() => { screen.getByRole('button', { name: 'Undo' }).click(); });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Town deleted.')).not.toBeInTheDocument();
  });

  it('waits while the pointer is on it, and keeps durationMs: null until dismissed', () => {
    jest.useFakeTimers();
    render(<ToastRegion />);

    act(() => {
      toast.info('Hover me.');
      toast.error('Sticky.', { durationMs: null });
    });
    fireEvent.mouseEnter(screen.getByText('Hover me.').closest('[data-kind]')!);
    act(() => { jest.advanceTimersByTime(60000); });
    expect(screen.getByText('Hover me.')).toBeInTheDocument();
    expect(screen.getByText('Sticky.')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByText('Hover me.').closest('[data-kind]')!);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.queryByText('Hover me.')).not.toBeInTheDocument();
    expect(screen.getByText('Sticky.')).toBeInTheDocument();
  });

  it('sends a plain toast.error through the error handler, one with options straight to the region', () => {
    const seen: unknown[] = [];
    const subscription = logging.errorHandler.subscribe(message => seen.push(message));
    render(<ToastRegion />);

    act(() => {
      toast.error('Plain.');
      toast.error('With a retry.', { action: { label: 'Retry', onClick: () => undefined } });
    });
    subscription.unsubscribe();

    expect(seen).toEqual(['Plain.']);
    expect(screen.getByText('Plain.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

