import { create } from 'zustand';

interface CounterState {
  count: number;
  setCount: (count: number) => void;
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  setCount: (count) => set({ count }),
}));
