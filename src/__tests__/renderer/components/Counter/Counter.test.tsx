import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Counter } from '@/renderer/components/Counter';
import { createMainChannelMock } from '@/__tests__/infrastructure/helpers/channelHelpers';

describe('Counter Component', () => {
  it('should call increment API without parameters when + button is clicked', async () => {
    const mainChannel = await createMainChannelMock();

    let calledCount = 0;
    mainChannel.onRequest('CounterMainApi:increment', (_data: unknown) => {
      calledCount += 1;
    });

    render(<Counter />);

    const incrementButton = screen.getByText('+');
    fireEvent.click(incrementButton);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(calledCount).toBe(1);
  });

  it('should call decrement API without parameters when - button is clicked', async () => {
    const mainChannel = await createMainChannelMock();

    let calledCount = 0;
    mainChannel.onRequest('CounterMainApi:decrement', (_data: unknown) => {
      calledCount += 1;
    });

    render(<Counter />);

    const decrementButton = screen.getByText('-');
    fireEvent.click(decrementButton);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(calledCount).toBe(1);
  });

  it('should handle increment errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mainChannel = await createMainChannelMock();

    mainChannel.onRequest('CounterMainApi:increment', async () => {
      throw new Error('Increment failed');
    });

    render(<Counter />);

    const incrementButton = screen.getByText('+');
    fireEvent.click(incrementButton);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to increment:', expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should display count from store', async () => {
    const { useCounterStore } = await import('@/renderer/stores/counterStore');

    useCounterStore.setState({ count: 5 });

    const { Counter } = await import('@/renderer/components/Counter');
    render(<Counter />);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
