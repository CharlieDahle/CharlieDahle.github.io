import { useState } from 'react'
import './drums.css';
import { Link } from 'react-router-dom'

function Drums() {
  const [count, setCount] = useState(0)

  return (
    <>
      {<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Link to="/home">
          <button>Go to Drums</button>
        </Link>
      </div>}
    </>
  )
}

export default Drums





/* This is the top parent of the drum machine. Componenet should be:
        - Controls
            - pause/play button
            - bpm adjuster
        - Tracks
            - base body for all of the tracks
            - measure counter at the top
            - track elements
                - sound selector
                - clickable track to program beats
                - 
      
      */