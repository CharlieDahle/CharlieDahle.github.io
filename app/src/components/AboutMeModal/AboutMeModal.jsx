import { X, User } from 'lucide-react';
import './AboutMeModal.css';

const AboutMeModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="aboutme-overlay" onClick={onClose}>
      <div className="aboutme-modal" onClick={(e) => e.stopPropagation()}>

        <div className="aboutme-header">
          <div className="aboutme-title-row">
            <User size={22} />
            <h2 className="aboutme-title">Charlie Dahle!</h2>
          </div>
          <button className="aboutme-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="aboutme-content">
          <p className="aboutme-text">
            To put this as succinctly as possible: I love building software that enables the greatness
            of humanity and that looks really cute. A lot of things interest me: working on DAWs, web
            design for artists, improving government functions through more easily navigable software,
            and educational tools. These are just a few.
          </p>
          <p className="aboutme-text">
            My skills and interests specifically lie in software architecture and project management...
            I find I'm good at seeing the bigger picture and making sure all the areas of an app come
            together cohesively.
          </p>
          <p className="aboutme-text">
            I have experience working in software as well as plenty of non-comp sci related work; like
            teaching English in French high schools and manual labor. I pride myself on this duality
            and I believe maintaining the balance helps my perspective on software stay grounded.
          </p>
          <p className="aboutme-text">
            I'm driven, I'm curious, and I care deeply about the world. Yeah
          </p>
        </div>

      </div>
    </div>
  );
};

export default AboutMeModal;
