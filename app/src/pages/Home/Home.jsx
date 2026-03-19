import { useState } from 'react'
import './Home.css'
import ShapeStack from '../ShapeStack/ShapeStack.jsx'
import OutfitStack from './OutfitStack.jsx'
import GuestbookModal from '../../components/GuestbookModal/GuestbookModal.jsx'
import AboutMeModal from '../../components/AboutMeModal/AboutMeModal.jsx'
import { Layers, Shirt } from 'lucide-react'
import StarTrail from '../../components/StarTrail/StarTrail.jsx'

function Home() {
  const [view, setView] = useState('shapes')
  const [guestbookOpen, setGuestbookOpen] = useState(false)
  const [aboutMeOpen, setAboutMeOpen] = useState(false)

  return (
    <div className={`home-container ${view === 'outfit' ? 'home-outfit-bg' : ''}`}>
      <div className="site-title">charliedahle.me</div>

      {/* Shape stack view */}
      <div className={`view-wrapper ${view === 'shapes' ? 'view-active' : 'view-hidden'}`}>
        <ShapeStack onOpenAboutMe={() => setAboutMeOpen(true)} />
      </div>

      {/* Outfit view */}
      <div className={`view-wrapper ${view === 'outfit' ? 'view-active' : 'view-hidden'}`}>
        <OutfitStack onOpenGuestbook={() => setGuestbookOpen(true)} onOpenAboutMe={() => setAboutMeOpen(true)} />
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
      <AboutMeModal isOpen={aboutMeOpen} onClose={() => setAboutMeOpen(false)} />
      <StarTrail />
    </div>
  )
}

export default Home
