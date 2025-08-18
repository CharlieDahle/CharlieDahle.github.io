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

  const [sortMode, setSortMode] = useState("sound"); // "sound" or "kit"
  const [selectedCategory, setSelectedCategory] = useState("kicks");
  const [selectedSound, setSelectedSound] = useState(null);
  const [loadedSounds, setLoadedSounds] = useState({});
  const [audioContext, setAudioContext] = useState(null);

  // Debug tracking state
  const [loadingAttempts, setLoadingAttempts] = useState(new Set());
  const [successfulLoads, setSuccessfulLoads] = useState(new Set());
  const [failedLoads, setFailedLoads] = useState(new Map()); // Map to store error details

  // Expose debug data to global window for debug panel access
  useEffect(() => {
    window.drumSoundDebugData = {
      attempted: Array.from(loadingAttempts),
      successful: Array.from(successfulLoads),
      failed: Array.from(failedLoads.entries()).map(([file, error]) => ({
        file,
        error,
      })),
      totalSounds: drumSounds ? drumSounds.length : 0,
      successRate:
        loadingAttempts.size > 0
          ? ((successfulLoads.size / loadingAttempts.size) * 100).toFixed(1)
          : 0,
    };
  }, [loadingAttempts, successfulLoads, failedLoads, drumSounds]);

  // Process drum sounds based on sort mode
  const processedSounds = React.useMemo(() => {
    if (!drumSounds || !Array.isArray(drumSounds))
      return { categories: {}, categoryList: [] };

    if (sortMode === "sound") {
      // Group by category (kicks, snares, etc.)
      const byCategory = {};
      drumSounds.forEach((sound) => {
        if (!byCategory[sound.category]) {
          byCategory[sound.category] = [];
        }
        byCategory[sound.category].push(sound);
      });
      return {
        categories: byCategory,
        categoryList: Object.keys(byCategory),
      };
    } else {
      // Group by kit (Legacy, Modern, etc.)
      const byKit = {};
      drumSounds.forEach((sound) => {
        if (!byKit[sound.kit]) {
          byKit[sound.kit] = [];
        }
        byKit[sound.kit].push(sound);
      });
      return {
        categories: byKit,
        categoryList: Object.keys(byKit),
      };
    }
  }, [drumSounds, sortMode]);

  // Initialize audio context
  useEffect(() => {
    if (soundModalOpen && !audioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(ctx);
    }
  }, [soundModalOpen, audioContext]);

  // Auto-select appropriate category when modal opens or sort mode changes
  useEffect(() => {
    if (soundModalOpen && soundModalTrack) {
      if (sortMode === "sound") {
        // Find the category that contains the track's current sound
        const soundObj = drumSounds.find(
          (s) => s.file === soundModalTrack.soundFile
        );
        if (
          soundObj &&
          processedSounds.categoryList.includes(soundObj.category)
        ) {
          setSelectedCategory(soundObj.category);
        } else if (processedSounds.categoryList.length > 0) {
          setSelectedCategory(processedSounds.categoryList[0]);
        }
      } else {
        // Find the kit that contains the track's current sound
        const soundObj = drumSounds.find(
          (s) => s.file === soundModalTrack.soundFile
        );
        if (soundObj && processedSounds.categoryList.includes(soundObj.kit)) {
          setSelectedCategory(soundObj.kit);
        } else if (processedSounds.categoryList.length > 0) {
          setSelectedCategory(processedSounds.categoryList[0]);
        }
      }

      // Set current sound as selected
      setSelectedSound(soundModalTrack.soundFile);
    }
  }, [
    soundModalOpen,
    soundModalTrack,
    drumSounds,
    sortMode,
    processedSounds.categoryList,
  ]);

  // Update selected category when switching sort modes
  useEffect(() => {
    if (
      processedSounds.categoryList.length > 0 &&
      !processedSounds.categoryList.includes(selectedCategory)
    ) {
      setSelectedCategory(processedSounds.categoryList[0]);
    }
  }, [sortMode, processedSounds.categoryList, selectedCategory]);

  // Load sounds for a category
  const loadCategorySounds = async (category) => {
    if (loadedSounds[category] || !audioContext) return;

    console.log(`Loading sounds for category: ${category}`);
    const sounds = processedSounds.categories[category] || [];
    const loadedBuffers = {};

    for (const sound of sounds) {
      try {
        // Track that we're attempting to load this sound
        setLoadingAttempts((prev) => new Set([...prev, sound.file]));

        const response = await fetch(`/${sound.file}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        loadedBuffers[sound.file] = audioBuffer;

        // Track successful load
        setSuccessfulLoads((prev) => new Set([...prev, sound.file]));
        console.log(`✅ Successfully loaded: ${sound.file}`);
      } catch (error) {
        console.error(`❌ Failed to load sound: ${sound.file}`, error);

        // Track failed load with error details
        setFailedLoads(
          (prev) => new Map([...prev, [sound.file, error.message]])
        );
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
    if (selectedSound && soundModalTrack) {
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

  const currentSounds = processedSounds.categories[selectedCategory] || [];

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

          {/* Sort Mode Toggle */}
          <div className="modal-body" style={{ paddingBottom: "0" }}>
            <div className="d-flex justify-content-center mb-3">
              <div className="btn-group" role="group">
                <input
                  type="radio"
                  className="btn-check"
                  name="sortMode"
                  id="sortBySound"
                  checked={sortMode === "sound"}
                  onChange={() => setSortMode("sound")}
                />
                <label
                  className="btn btn-outline-primary"
                  htmlFor="sortBySound"
                >
                  Sort by Sound
                </label>

                <input
                  type="radio"
                  className="btn-check"
                  name="sortMode"
                  id="sortByKit"
                  checked={sortMode === "kit"}
                  onChange={() => setSortMode("kit")}
                />
                <label className="btn btn-outline-primary" htmlFor="sortByKit">
                  Sort by Kit
                </label>
              </div>
            </div>
          </div>

          <div
            className="modal-body"
            style={{ height: "400px", paddingTop: "0" }}
          >
            <div className="row h-100">
              {/* Categories */}
              <div className="col-4 border-end">
                <h6 className="text-muted mb-3">
                  {sortMode === "sound" ? "Categories" : "Kits"}
                </h6>
                <div className="list-group list-group-flush">
                  {processedSounds.categoryList.map((category) => (
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
                      const hasFailed = failedLoads.has(sound.file);
                      return (
                        <button
                          key={sound.file}
                          className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${
                            selectedSound === sound.file ? "active" : ""
                          } ${!isLoaded ? "text-muted" : ""} ${
                            hasFailed ? "border-danger" : ""
                          }`}
                          onClick={() => handleSoundClick(sound.file)}
                          disabled={!isLoaded}
                        >
                          <div className="d-flex flex-column align-items-start">
                            <span>{sound.name}</span>
                            {sortMode === "kit" && (
                              <small className="text-muted">
                                {sound.category}
                              </small>
                            )}
                            {sortMode === "sound" && (
                              <small className="text-muted">{sound.kit}</small>
                            )}
                          </div>
                          <span
                            className={`badge ${
                              hasFailed
                                ? "bg-danger"
                                : isLoaded
                                ? "bg-secondary"
                                : "bg-warning"
                            }`}
                          >
                            {hasFailed ? "✗" : isLoaded ? "♪" : "..."}
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
