import React, { useState, useEffect } from "react";
import { useAppStore } from "../../stores";

function SoundSelectorModal({ drumSounds }) {
  // Get UI state and actions
  const soundModalOpen = useAppStore((state) => state.ui.soundModalOpen);
  const soundModalTrack = useAppStore((state) => state.ui.soundModalTrack);
  const closeSoundModal = useAppStore((state) => state.ui.closeSoundModal);

  // Get track action
  const updateTrackSound = useAppStore(
    (state) => state.tracks.updateTrackSound
  );

  const [selectedCategory, setSelectedCategory] = useState("kicks");
  const [selectedSound, setSelectedSound] = useState(null);
  const [loadedSounds, setLoadedSounds] = useState({});
  const [audioContext, setAudioContext] = useState(null);

  // Initialize audio context
  useEffect(() => {
    if (soundModalOpen && !audioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(ctx);
    }
  }, [soundModalOpen]);

  // Auto-select track's current category when modal opens
  useEffect(() => {
    if (soundModalOpen && soundModalTrack) {
      // Find which category contains the track's current sound
      const categories = Object.keys(drumSounds);
      for (const category of categories) {
        const soundExists = drumSounds[category].some(
          (sound) => sound.file === soundModalTrack.soundFile
        );
        if (soundExists) {
          setSelectedCategory(category);
          break;
        }
      }
      // Set current sound as selected
      setSelectedSound(soundModalTrack.soundFile);
    }
  }, [soundModalOpen, soundModalTrack, drumSounds]);

  // Load sounds for a category
  const loadCategorySounds = async (category) => {
    if (loadedSounds[category] || !audioContext) return;

    console.log(`Loading sounds for category: ${category}`);
    const sounds = drumSounds[category];
    const loadedBuffers = {};

    for (const sound of sounds) {
      try {
        const response = await fetch(`/${sound.file}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        loadedBuffers[sound.file] = audioBuffer;
      } catch (error) {
        console.error(`Failed to load sound: ${sound.file}`, error);
      }
    }

    setLoadedSounds((prev) => ({
      ...prev,
      [category]: loadedBuffers,
    }));
  };

  // Handle category selection
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    loadCategorySounds(category);
  };

  // Play sound preview
  const playSound = (soundFile) => {
    if (!audioContext || !loadedSounds[selectedCategory]?.[soundFile]) return;

    const audioBuffer = loadedSounds[selectedCategory][soundFile];
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
  };

  // Handle sound selection
  const handleSoundClick = (soundFile) => {
    setSelectedSound(soundFile);
    playSound(soundFile);
  };

  // Handle apply - now just calls the store action
  const handleApply = () => {
    if (selectedSound && soundModalTrack) {
      // This now handles both local state and WebSocket automatically
      updateTrackSound(soundModalTrack.id, selectedSound);
    }
    closeSoundModal();
  };

  // Load sounds for initial category when modal opens
  useEffect(() => {
    if (soundModalOpen && selectedCategory && audioContext) {
      loadCategorySounds(selectedCategory);
    }
  }, [soundModalOpen, selectedCategory, audioContext]);

  // Handle Escape key and click outside to close modal
  useEffect(() => {
    if (!soundModalOpen) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeSoundModal();
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.classList.contains("modal")) {
        closeSoundModal();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [soundModalOpen, closeSoundModal]);

  if (!soundModalOpen) return null;

  const categories = Object.keys(drumSounds);
  const currentSounds = drumSounds[selectedCategory] || [];

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeSoundModal();
        }
      }}
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Select Sound for {soundModalTrack?.name}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={closeSoundModal}
            ></button>
          </div>

          <div className="modal-body" style={{ height: "400px" }}>
            <div className="row h-100">
              {/* Categories */}
              <div className="col-4 border-end">
                <h6 className="text-muted mb-3">Categories</h6>
                <div className="list-group list-group-flush">
                  {categories.map((category) => (
                    <button
                      key={category}
                      className={`list-group-item list-group-item-action ${
                        selectedCategory === category ? "active" : ""
                      }`}
                      onClick={() => handleCategoryClick(category)}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sounds */}
              <div className="col-8">
                <h6 className="text-muted mb-3">
                  {selectedCategory.charAt(0).toUpperCase() +
                    selectedCategory.slice(1)}{" "}
                  Sounds
                  <small className="text-info ms-2">
                    ({Object.keys(loadedSounds[selectedCategory] || {}).length}{" "}
                    loaded)
                  </small>
                </h6>
                <div style={{ height: "300px", overflowY: "auto" }}>
                  <div className="list-group">
                    {currentSounds.map((sound) => {
                      const isLoaded =
                        loadedSounds[selectedCategory]?.[sound.file];
                      return (
                        <button
                          key={sound.file}
                          className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                            selectedSound === sound.file ? "active" : ""
                          } ${!isLoaded ? "text-muted" : ""}`}
                          onClick={() => handleSoundClick(sound.file)}
                          disabled={!isLoaded}
                        >
                          <span>{sound.name}</span>
                          <span
                            className={`badge ${
                              isLoaded ? "bg-secondary" : "bg-warning"
                            }`}
                          >
                            {isLoaded ? "♪" : "..."}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeSoundModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={!selectedSound}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SoundSelectorModal;
