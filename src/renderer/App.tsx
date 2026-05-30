import React from 'react';
import { logger } from '@/shared/utils/log';
import { Counter } from './components/Counter';

const log = logger(__SOURCE_FILE__);

export default function App() {
  log.info('App rendered');
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Counter />
    </div>
  );
}
