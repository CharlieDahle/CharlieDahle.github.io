import React, { useState, useEffect } from "react";

function SoundSelectorModal({
  isOpen,
  onClose,
  track,
  drumSounds,
  onSoundSelect,
}) {
  const [selectedCategory, setSelectedCategory] = useState("kicks");
  const [selectedSound, setSelectedSound] = useState(null);
  const [loadedSounds, setLoadedSounds] = useState({});
  const [audioContext, setAudioContext] = useState(null);

  // Initialize audio context
  useEffect(() => {
    if (isOpen && !audioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(ctx);
    }
  }, [isOpen]);

  // Auto-select track's current category when modal opens
  useEffect(() => {
    if (isOpen && track) {
      // Find which category contains the track's current sound
      const categories = Object.keys(drumSounds);
      for (const category of categories) {
        const soundExists = drumSounds[category].some(
          (sound) => sound.file === track.soundFile
        );
        if (soundExists) {
          setSelectedCategory(category);
          break;
        }
      }
      // Set current sound as selected
      setSelectedSound(track.soundFile);
    }
  }, [isOpen, track, drumSounds]);

  // Load sounds for a category
  const loadCategorySounds = async (category) => {
    if (loadedSounds[category] || !audioContext) return;

    console.log(`Loading sounds for category: ${category}`);
    const sounds = drumSounds[category];
    const loadedBuffers = {};

    for (const sound of sounds) {
      try {
        const response = await fetch(`/sounds/${sound.file}`);
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

  // Handle apply
  const handleApply = () => {
    if (selectedSound) {
      onSoundSelect(selectedSound);
    }
    onClose();
  };

  // Load sounds for initial category when modal opens
  useEffect(() => {
    if (isOpen && selectedCategory) {
      loadCategorySounds(selectedCategory);
    }
  }, [isOpen, selectedCategory]);

  if (!isOpen) return null;

  const categories = Object.keys(drumSounds);
  const currentSounds = drumSounds[selectedCategory] || [];

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Select Sound for {track?.name}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
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
                </h6>
                <div style={{ height: "300px", overflowY: "auto" }}>
                  <div className="list-group">
                    {currentSounds.map((sound) => (
                      <button
                        key={sound.file}
                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                          selectedSound === sound.file ? "active" : ""
                        }`}
                        onClick={() => handleSoundClick(sound.file)}
                      >
                        <span>{sound.name}</span>
                        <span className="badge bg-secondary">♪</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
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
