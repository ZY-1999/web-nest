import { logger } from '@/shared/utils/log';
import { WebCatalog } from './components/WebCatalog';
import { TitleBar } from './components/TitleBar';

const log = logger(__SOURCE_FILE__);

export default function App() {
  log.info('App rendered');
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TitleBar />
      <WebCatalog />
    </div>
  );
}
