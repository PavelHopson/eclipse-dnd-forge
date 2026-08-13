import { NextUIProvider } from '@nextui-org/react';
import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import Launcher from './view/Launcher';
import AuthCallbackPage from './view/auth/AuthCallbackPage';
import IdentityCanaryPage from './view/auth/IdentityCanaryPage';

const VisualWritingInterface = lazy(() => import('./view/VisualWritingInterface'));
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
      const { useStudyStore } = await import('./study/StudyModel');
      useStudyStore.getState().setIsDataSaved(false);
      return null;
    },
    element: deferred(<VisualWritingInterface />),
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
