import React from 'react';
import { Button } from '@/renderer/components/ui/button';
import { useCounterStore } from '../../stores/counterStore';
import { counterMainApi } from '@/shared/services';

export function Counter() {
  const { count } = useCounterStore();

  const handleIncrement = async () => {
    try {
      await counterMainApi.increment();
    } catch (error) {
      console.error('Failed to increment:', error);
    }
  };

  const handleDecrement = async () => {
    try {
      await counterMainApi.decrement();
    } catch (error) {
      console.error('Failed to decrement:', error);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 rounded-2xl bg-white/10 p-12 backdrop-blur-lg shadow-2xl">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
        Electron Counter
      </h1>
      <div className="flex flex-col items-center gap-4">
        <p className="text-6xl font-bold text-white">{count}</p>
        <div className="flex gap-4">
          <Button onClick={handleDecrement} variant="outline" size="lg">
            -
          </Button>
          <Button onClick={handleIncrement} variant="outline" size="lg">
            +
          </Button>
        </div>
      </div>
      <p className="text-sm text-gray-300">
        Powered by Zustand + Tailwind CSS + shadcn/ui + IPC
      </p>
    </div>
  );
}
