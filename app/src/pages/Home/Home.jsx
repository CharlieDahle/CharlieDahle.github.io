import { useState } from 'react'
import './Home.css'
import ShapeStack from '../ShapeStack/ShapeStack.jsx'
import OutfitStack from './OutfitStack.jsx'
import GuestbookModal from '../../components/GuestbookModal/GuestbookModal.jsx'
import { Layers, Shirt } from 'lucide-react'
import StarTrail from '../../components/StarTrail/StarTrail.jsx'

function Home() {
  const [view, setView] = useState('shapes')
  const [guestbookOpen, setGuestbookOpen] = useState(false)

  return (
    <div className={`home-container ${view === 'outfit' ? 'home-outfit-bg' : ''}`}>
      <div className="site-title">charliedahle.me</div>

      {/* Shape stack view */}
      <div className={`view-wrapper ${view === 'shapes' ? 'view-active' : 'view-hidden'}`}>
        <ShapeStack />
      </div>

      {/* Outfit view */}
      <div className={`view-wrapper ${view === 'outfit' ? 'view-active' : 'view-hidden'}`}>
        <OutfitStack onOpenGuestbook={() => setGuestbookOpen(true)} />
      </div>

      {/* View toggle */}
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${view === 'shapes' ? 'view-toggle-active' : ''}`}
          onClick={() => setView('shapes')}
          title="Shape Stack"
        >
          <Layers size={18} />
        </button>
        <button
          className={`view-toggle-btn ${view === 'outfit' ? 'view-toggle-active' : ''}`}
          onClick={() => setView('outfit')}
          title="Outfit"
        >
          <Shirt size={18} />
        </button>
      </div>

      <GuestbookModal isOpen={guestbookOpen} onClose={() => setGuestbookOpen(false)} />
      <StarTrail />
    </div>
  )
}

export default Home
