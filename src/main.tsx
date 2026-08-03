import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { stripLegacyCredentialFromAddress } from './model/ai/credentialStorage.ts'
import { hasAuthorizationCallback } from './model/auth/dndSession.ts'

stripLegacyCredentialFromAddress()
if (hasAuthorizationCallback() && window.location.hash !== '#/auth/callback') {
  window.location.hash = '/auth/callback'
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
)
