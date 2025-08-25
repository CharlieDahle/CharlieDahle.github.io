import React, { useState, useEffect } from "react";
import { Music } from "lucide-react";
import { useAppStore } from "../../stores";
import "./SoundSelectorModal.css";

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
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);
  const [focusedSoundIndex, setFocusedSoundIndex] = useState(-1);

  // Debug tracking state
  const [loadingAttempts, setLoadingAttempts] = useState(new Set());
  const [successfulLoads, setSuccessfulLoads] = useState(new Set());
  const [failedLoads, setFailedLoads] = useState(new Map()); // Map to store error details

  // Helper function to properly encode file paths
  const encodeFilePath = (filePath) => {
    return filePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  };

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
    setIsLoadingCategory(true);

    const sounds = processedSounds.categories[category] || [];
    const loadedBuffers = {};

    for (const sound of sounds) {
      try {
        // Track that we're attempting to load this sound
        setLoadingAttempts((prev) => new Set([...prev, sound.file]));

        // Properly encode the file path for URL usage
        const encodedPath = encodeFilePath(sound.file);
        console.log(`Attempting to load:`, {
          original: sound.file,
          encoded: encodedPath,
          name: sound.name,
        });

        const response = await fetch(`/${encodedPath}`);

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

    setIsLoadingCategory(false);
  };

  // Handle category selection
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setFocusedSoundIndex(-1); // Reset focused index when changing categories
    loadCategorySounds(category);
  };

  // Play sound preview
  const playSound = (soundFile) => {
    if (!audioContext || !loadedSounds[selectedCategory]?.[soundFile]) return;

    console.log(`Playing sound: ${soundFile}`);
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

  // Handle cancel
  const handleCancel = () => {
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

    const handleKeyDown = (e) => {
      const currentSounds = processedSounds.categories[selectedCategory] || [];
      const availableSounds = currentSounds.filter(
        (sound) => loadedSounds[selectedCategory]?.[sound.file]
      );

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          closeSoundModal();
          break;

        case "ArrowDown":
          e.preventDefault();
          if (availableSounds.length > 0) {
            const nextIndex =
              focusedSoundIndex < availableSounds.length - 1
                ? focusedSoundIndex + 1
                : 0;
            setFocusedSoundIndex(nextIndex);
            const nextSound = availableSounds[nextIndex];
            if (nextSound) {
              setSelectedSound(nextSound.file);
              playSound(nextSound.file);
            }
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (availableSounds.length > 0) {
            const nextIndex =
              focusedSoundIndex > 0
                ? focusedSoundIndex - 1
                : availableSounds.length - 1;
            setFocusedSoundIndex(nextIndex);
            const nextSound = availableSounds[nextIndex];
            if (nextSound) {
              setSelectedSound(nextSound.file);
              playSound(nextSound.file);
            }
          }
          break;

        case "Enter":
          e.preventDefault();
          if (selectedSound) {
            handleApply();
          }
          break;
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.classList.contains("sound-modal-overlay")) {
        closeSoundModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [
    soundModalOpen,
    closeSoundModal,
    processedSounds,
    selectedCategory,
    loadedSounds,
    focusedSoundIndex,
    selectedSound,
    handleApply,
  ]);

  if (!soundModalOpen || !soundModalTrack) return null;

  const currentSounds = processedSounds.categories[selectedCategory] || [];
  const loadedCount = Object.keys(loadedSounds[selectedCategory] || {}).length;

  return (
    <div className="sound-modal-overlay">
      <div className="sound-modal">
        <div className="sound-modal-header">
          <h3 className="sound-modal-title">
            <Music size={20} />
            Select Sound for {soundModalTrack.name}
          </h3>
          <button className="sound-close-btn" onClick={handleCancel}>
            &times;
          </button>
        </div>

        <div className="sound-modal-body">
          {/* Sort Mode Toggle */}
          <div className="sort-mode-toggle">
            <div className="sort-mode-buttons">
              <button
                className={`sort-mode-btn ${
                  sortMode === "sound" ? "active" : ""
                }`}
                onClick={() => setSortMode("sound")}
              >
                Sort by Sound
              </button>
              <button
                className={`sort-mode-btn ${
                  sortMode === "kit" ? "active" : ""
                }`}
                onClick={() => setSortMode("kit")}
              >
                Sort by Kit
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="sound-content">
            {/* Categories Sidebar */}
            <div className="categories-sidebar">
              <h6 className="categories-header">
                {sortMode === "sound" ? "Categories" : "Kits"}
              </h6>
              <div className="categories-list">
                {processedSounds.categoryList.map((category) => (
                  <button
                    key={category}
                    className={`category-item ${
                      selectedCategory === category ? "active" : ""
                    }`}
                    onClick={() => handleCategoryClick(category)}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Sounds Area */}
            <div className="sounds-area">
              <div className="sounds-header">
                <h6 className="sounds-title">
                  {selectedCategory.charAt(0).toUpperCase() +
                    selectedCategory.slice(1)}{" "}
                  Sounds
                </h6>
                {isLoadingCategory ? (
                  <div className="loading-indicator">
                    <div className="loading-spinner"></div>
                    Loading sounds...
                  </div>
                ) : (
                  <span className="sounds-count">
                    {loadedCount} of {currentSounds.length} loaded
                  </span>
                )}
              </div>

              <div className="sounds-list">
                {currentSounds.map((sound) => {
                  const isLoaded = loadedSounds[selectedCategory]?.[sound.file];
                  const hasFailed = failedLoads.has(sound.file);
                  const isLoading =
                    loadingAttempts.has(sound.file) && !isLoaded && !hasFailed;

                  return (
                    <button
                      key={sound.file}
                      className={`sound-item ${
                        selectedSound === sound.file ? "active" : ""
                      }`}
                      onClick={() => handleSoundClick(sound.file)}
                      disabled={!isLoaded}
                    >
                      <div className="sound-info">
                        <div className="sound-name">{sound.name}</div>
                        {sortMode === "kit" && (
                          <div className="sound-category">{sound.category}</div>
                        )}
                        {sortMode === "sound" && (
                          <div className="sound-category">{sound.kit}</div>
                        )}
                      </div>
                      <div
                        className={`sound-status ${
                          hasFailed ? "failed" : isLoaded ? "loaded" : "loading"
                        }`}
                      >
                        {hasFailed
                          ? "✗"
                          : isLoaded
                          ? "♪"
                          : isLoading
                          ? "..."
                          : "○"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="sound-modal-footer">
          <button
            className="sound-btn sound-btn--secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="sound-btn sound-btn--primary"
            onClick={handleApply}
            disabled={!selectedSound}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default SoundSelectorModal;
