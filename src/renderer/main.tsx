import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { serviceRegistry } from '@/shared/serviceRegistry';
import { channel } from '@/shared/channel';
import { counterRendererService } from './services/counterService';

serviceRegistry.setDefaultChannel(channel);
serviceRegistry.implementService(channel, counterRendererService);

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
