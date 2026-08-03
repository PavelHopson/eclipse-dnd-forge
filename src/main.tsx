import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { stripLegacyCredentialFromAddress } from './model/ai/credentialStorage.ts'

stripLegacyCredentialFromAddress()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
)
