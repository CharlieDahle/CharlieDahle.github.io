import { useState } from 'react'
import './shapestack.css'
import { Link } from 'react-router-dom'

function ShapeStack() {
  const [hoveredBlob, setHoveredBlob] = useState(null)
  
  // Define text for each blob
  const blobTexts = {
    1: "Spotify",
    2: "Console", 
    3: "Github",
    4: "Drum Machine",
    5: "Social Media",
    6: "About me + resume"
  }
  
  // Default text when not hovering
  const defaultText = "Menu"
  
  // Get current text based on hover state
  const currentText = hoveredBlob ? blobTexts[hoveredBlob] : defaultText
  
  return (
    <> 
      <div className="site-title">charliedahle.me</div>
      <div className="shape-stack">
        <div 
          className="blob-shape shape-1 blob-1"
          onMouseEnter={() => setHoveredBlob(1)}
          onMouseLeave={() => setHoveredBlob(null)}
        ></div>
        <div 
          className="blob-shape shape-2 blob-2"
          onMouseEnter={() => setHoveredBlob(2)}
          onMouseLeave={() => setHoveredBlob(null)}
        ></div>
        <div 
          className="blob-shape shape-3 blob-3"
          onMouseEnter={() => setHoveredBlob(3)}
          onMouseLeave={() => setHoveredBlob(null)}
        ></div>
        <Link to="/DrumMachine">
          <div
            className="blob-shape shape-4 blob-4"
            onMouseEnter={() => setHoveredBlob(4)}
            onMouseLeave={() => setHoveredBlob(null)}
          ></div>
        </Link>

        <div 
          className="blob-shape shape-5 blob-5"
          onMouseEnter={() => setHoveredBlob(5)}
          onMouseLeave={() => setHoveredBlob(null)}
        ></div>
        <div 
          className="blob-shape shape-6 blob-6"
          onMouseEnter={() => setHoveredBlob(6)}
          onMouseLeave={() => setHoveredBlob(null)}
        ></div>
        <div className="center-text">
          {currentText}
        </div>
      </div>
    </>
  );
}

export default ShapeStack