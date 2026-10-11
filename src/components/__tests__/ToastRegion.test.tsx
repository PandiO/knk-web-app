import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastRegion } from '../ToastRegion';
import { logging } from '../../utils';

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
});

