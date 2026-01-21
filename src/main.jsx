import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'
import { HashRouter } from 'react-router'

ReactDOM.createRoot(document.getElementById('app')).render(
  <HashRouter>
    <App />
  </HashRouter>
)