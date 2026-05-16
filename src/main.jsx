import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'
import { BrowserRouter } from 'react-router'

ReactDOM.createRoot(document.getElementById('app')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)