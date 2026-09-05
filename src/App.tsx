import { NextUIProvider } from '@nextui-org/react';
import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import Launcher from './view/Launcher';
import AuthCallbackPage from './view/auth/AuthCallbackPage';
import IdentityCanaryPage from './view/auth/IdentityCanaryPage';
import CampaignLoadError from './view/dnd/CampaignLoadError';
import './view/dnd/CampaignLibrary.css';

const VisualWritingInterface = lazy(() => import('./view/VisualWritingInterface'));
const CampaignBar = lazy(() => import('./view/dnd/CampaignBar'));
const StudyInterface = lazy(() => import('./study/StudyInterface'));
const BaselineInterface = lazy(() => import('./study/BaselineInterface'));

function RouteLoading() {
  return (
    <main className="dnd-route-loading" aria-live="polite" aria-busy="true">
      <span className="dnd-route-loading__signal" aria-hidden="true" />
      <p>Открываем кампанию…</p>
    </main>
  );
}

function deferred(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

const router = createHashRouter([
  {
    path: 'free-form',
    loader: async () => {
      const { campaignRepository } = await import('./model/dnd/campaignStorage');
      campaignRepository().prepare();
      const { acquireCampaignWriteLock } = await import('./model/dnd/campaignWriteLock');
      await acquireCampaignWriteLock();
      const { useStudyStore } = await import('./study/StudyModel');
      useStudyStore.getState().setIsDataSaved(false);
      const { restoreCampaignWorkspace } = await import('./model/dnd/campaignPersistence');
      restoreCampaignWorkspace();
      return null;
    },
    element: deferred(<div className="campaign-frame"><CampaignBar /><div className="campaign-frame__body"><VisualWritingInterface /></div></div>),
    errorElement: <CampaignLoadError />,
  },
  {
    path: 'study',
    element: deferred(<StudyInterface />),
  },
  {
    path: 'baseline',
    element: deferred(<BaselineInterface />),
  },
  {
    path: 'auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: 'auth/canary',
    element: <IdentityCanaryPage />,
  },
  {
    path: '/',
    element: <Launcher />,
  },
]);

function App() {
  return (
    <StrictMode>
      <NextUIProvider>
        <RouterProvider router={router} />
      </NextUIProvider>
    </StrictMode>
  );
}

export default App;
