import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// creates a root element and renders the App component inside it, 
// wrapped in React.StrictMode for highlighting potential problems in the app
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

