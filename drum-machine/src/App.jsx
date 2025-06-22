import { useState } from 'react'
import './styles/App.css';

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="terminal">
        <div className="terminal-output" id="output"></div>
        <div className="terminal-input">
            <input type="text" id="command-input" autofocus/>
        </div>
      </div>
    </>
  )
}

export default App
