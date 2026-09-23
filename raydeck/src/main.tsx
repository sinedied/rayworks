import { createRoot } from 'react-dom/client';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

import App from '@/App';

import './global.css';

createRoot(document.getElementById('root')!).render(<App />);
