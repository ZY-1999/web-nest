import React from 'react';
import { logger } from '@/shared/utils/log';
import { WebCatalog } from './components/WebCatalog';
import { ThemeToggle } from './components/ThemeToggle';

const log = logger(__SOURCE_FILE__);

export default function App() {
  log.info('App rendered');
  return (
    <>
      <ThemeToggle />
      <WebCatalog />
    </>
  );
}
