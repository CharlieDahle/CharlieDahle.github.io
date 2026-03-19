import { Link } from 'react-router-dom'
import './OutfitStack.css'

const OutfitStack = ({ onOpenGuestbook, onOpenAboutMe }) => {
  return (
    <div className="outfit-stack">

      <div className="outfit-item outfit-zidane">
        <img src="/zidane.png" alt="Zidane" style={{ width: '100%', display: 'block' }} />
        <span className="outfit-label">Zidane</span>
      </div>

      <Link to="https://github.com/CharlieDahle">
        <div className="outfit-item outfit-pants">
          <img src="/dickies.png" alt="Pants" style={{ width: '100%', display: 'block' }} />
          <span className="outfit-label">Github</span>
        </div>
      </Link>

      <div className="outfit-item outfit-shirt" onClick={onOpenAboutMe}>
        <img src="/shirt.png" alt="Shirt" style={{ width: '100%', display: 'block' }} />
        <span className="outfit-label">About me</span>
      </div>

      <Link to="/DrumMachine">
        <div className="outfit-item outfit-bass">
          <img src="/bass.png" alt="Bass loafers" style={{ width: '100%', display: 'block' }} />
          <span className="outfit-label">Drum Machine</span>
        </div>
      </Link>

      <Link to="/Photos">
        <div className="outfit-item outfit-volvo">
          <img src="/volvo.png" alt="Volvo key" style={{ width: '100%', display: 'block' }} />
          <span className="outfit-label">Photos</span>
        </div>
      </Link>

      <Link to="https://open.spotify.com/user/charliedahle161">
        <div className="outfit-item outfit-straw">
          <img src="/straw.png" alt="Strawberry" style={{ width: '100%', display: 'block' }} />
          <span className="outfit-label">Spotify</span>
        </div>
      </Link>

      <div className="outfit-item outfit-book" onClick={onOpenGuestbook}>
        <img src="/book.png" alt="Book" style={{ width: '100%', display: 'block' }} />
        <span className="outfit-label">Guest Book</span>
      </div>

    </div>
  )
}

export default OutfitStack
