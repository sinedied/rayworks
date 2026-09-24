import { createRoot } from 'react-dom/client';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

import App from '@/App';
import { AudienceView } from '@/components/AudienceView';
import { audienceSessionId } from '@/presentation/session';

import './global.css';

const audience = new URLSearchParams(window.location.hash.slice(1)).has('audience');
createRoot(document.getElementById('root')!).render(
  audience ? <AudienceView sessionId={audienceSessionId(window.location.hash)} /> : <App />,
);
