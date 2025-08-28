import React, { useState, useEffect } from "react";
import {
  Sliders,
  BarChart3,
  Filter,
  Volume2,
  Repeat,
  Zap,
  Waves,
  Settings,
  RotateCcw,
  Palette,
} from "lucide-react";
import { useAppStore } from "../../stores";
import "./EffectsModal.css";

function EffectsModal() {
  // Get UI state and actions
  const effectsModalOpen = useAppStore((state) => state.ui.effectsModalOpen);
  const effectsModalTrack = useAppStore((state) => state.ui.effectsModalTrack);
  const closeEffectsModal = useAppStore((state) => state.ui.closeEffectsModal);

  // Get effects actions
  const updateTrackEffect = useAppStore(
    (state) => state.effects.updateTrackEffect
  );
  const resetTrackEffects = useAppStore(
    (state) => state.effects.resetTrackEffects
  );
  const getTrackEffects = useAppStore((state) => state.effects.getTrackEffects);
  const applyEffectChanges = useAppStore((state) => state.effects.applyEffectChanges);
  const hasPendingChanges = useAppStore((state) => state.effects.hasPendingChanges);
  const clearPendingChanges = useAppStore((state) => state.effects.clearPendingChanges);
  const resetAllEffects = useAppStore((state) => state.effects.resetAllEffects);
  const resetEffect = useAppStore((state) => state.effects.resetEffect);
  
  // Preset actions
  const getPresetsForTrackType = useAppStore((state) => state.effects.getPresetsForTrackType);
  const getTrackTypeFromId = useAppStore((state) => state.effects.getTrackTypeFromId);
  const getCurrentPreset = useAppStore((state) => state.effects.getCurrentPreset);
  const getTrackNumber = useAppStore((state) => state.effects.getTrackNumber);
  const getDefaultEffects = useAppStore((state) => state.effects.getDefaultEffects);
  const getCategoryDisplayName = useAppStore((state) => state.effects.getCategoryDisplayName);

  const [activeTab, setActiveTab] = useState("presets");
  const [tempEffects, setTempEffects] = useState(null);
  const [originalEffects, setOriginalEffects] = useState(null);
  const [trackInfo, setTrackInfo] = useState(null);

  // Load current effects when modal opens
  useEffect(() => {
    if (effectsModalOpen && effectsModalTrack) {
      const currentEffects = getTrackEffects(effectsModalTrack.id);
      setTempEffects({ ...currentEffects });
      setOriginalEffects({ ...currentEffects });
      
      // Compute and cache track info once
      const trackType = getTrackTypeFromId(effectsModalTrack.id);
      const categoryDisplayName = getCategoryDisplayName(effectsModalTrack.id);
      const presets = trackType ? getPresetsForTrackType(trackType) : [];
      
      const hasPresets = presets.length > 0;
      setTrackInfo({
        trackType,
        categoryDisplayName,
        presets,
        hasPresets
      });
      
      // Set default tab based on whether presets are available
      setActiveTab(hasPresets ? "presets" : "eq");
    }
  }, [effectsModalOpen, effectsModalTrack, getTrackEffects, getTrackTypeFromId, getCategoryDisplayName, getPresetsForTrackType]);

  const handleEffectChange = (effectType, parameter, value) => {
    const newEffects = {
      ...tempEffects,
      [effectType]: {
        ...tempEffects[effectType],
        [parameter]: value,
      },
    };
    setTempEffects(newEffects);

    // Apply change LOCALLY for real-time preview (no WebSocket broadcast)
    updateTrackEffect(effectsModalTrack.id, effectType, parameter, value);
  };

  // Handle Apply - broadcast all pending changes using new store method
  const handleApply = () => {
    if (effectsModalTrack) {
      console.log(`Applying effects for ${effectsModalTrack.name}`);
      
      // Use the new store method that handles everything
      applyEffectChanges(effectsModalTrack.id);
    }

    closeEffectsModal();
  };

  // Handle Cancel - revert to original settings and clear pending changes
  const handleCancel = () => {
    if (originalEffects && effectsModalTrack) {
      // Revert all effects to original state
      Object.keys(originalEffects).forEach((effectType) => {
        Object.keys(originalEffects[effectType]).forEach((parameter) => {
          updateTrackEffect(
            effectsModalTrack.id,
            effectType,
            parameter,
            originalEffects[effectType][parameter]
          );
        });
      });
      
      // Clear any pending changes
      clearPendingChanges(effectsModalTrack.id);
    }
    closeEffectsModal();
  };

  // Handle Reset - reset to defaults using new store method
  const handleReset = () => {
    if (effectsModalTrack) {
      resetAllEffects(effectsModalTrack.id);
      const resetEffects = getTrackEffects(effectsModalTrack.id);
      setTempEffects({ ...resetEffects });
    }
  };

  // Handle Reset Individual Effect
  const handleResetEffect = (effectType) => {
    if (effectsModalTrack) {
      resetEffect(effectsModalTrack.id, effectType);
      const updatedEffects = getTrackEffects(effectsModalTrack.id);
      setTempEffects({ ...updatedEffects });
    }
  };

  // Handle Preset Application
  const handleApplyPreset = (presetId) => {
    if (effectsModalTrack && trackInfo) {
      const currentPreset = getCurrentPreset(effectsModalTrack.id);
      
      // If clicking on already active preset, toggle it off (reset to defaults)
      if (currentPreset && currentPreset.id === presetId) {
        // Apply default values through handleEffectChange to trigger pending changes
        const defaultEffects = getDefaultEffects();
        Object.entries(defaultEffects).forEach(([effectType, effectParams]) => {
          Object.entries(effectParams).forEach(([parameter, value]) => {
            handleEffectChange(effectType, parameter, value);
          });
        });
        return;
      }
      
      // Get preset data from cached trackInfo
      const preset = trackInfo.presets.find(p => p.id === presetId);
      
      if (preset && preset.effects) {
        // Apply each parameter individually to trigger pending changes
        Object.entries(preset.effects).forEach(([effectType, effectParams]) => {
          Object.entries(effectParams).forEach(([parameter, value]) => {
            handleEffectChange(effectType, parameter, value);
          });
        });
      }
    }
  };

  // Handle Escape key and click outside
  useEffect(() => {
    if (!effectsModalOpen) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.classList.contains("effects-modal-overlay")) {
        handleCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [effectsModalOpen]);

  if (!effectsModalOpen || !effectsModalTrack || !tempEffects) return null;

  return (
    <div className="effects-modal-overlay">
      <div className="effects-modal">
        <div className="effects-modal-header">
          <h3 className="effects-modal-title">
            <Sliders size={20} />
            {trackInfo?.categoryDisplayName || 'Track'} Effects
          </h3>
          <button className="effects-close-btn" onClick={handleCancel}>
            &times;
          </button>
        </div>

        <div className="effects-modal-body">
          {/* Effect Tabs */}
          <div className="effects-tabs">
            {trackInfo?.hasPresets && (
              <button
                className={`effects-tab ${activeTab === "presets" ? "active" : ""}`}
                onClick={() => setActiveTab("presets")}
              >
                <Palette size={14} />
                Presets
              </button>
            )}
            <button
              className={`effects-tab ${activeTab === "eq" ? "active" : ""}`}
              onClick={() => setActiveTab("eq")}
            >
              <BarChart3 size={14} />
              EQ
            </button>
            <button
              className={`effects-tab ${
                activeTab === "filter" ? "active" : ""
              }`}
              onClick={() => setActiveTab("filter")}
            >
              <Filter size={14} />
              Filter
            </button>
            <button
              className={`effects-tab ${
                activeTab === "dynamics" ? "active" : ""
              }`}
              onClick={() => setActiveTab("dynamics")}
            >
              <Zap size={14} />
              Dynamics
            </button>
            <button
              className={`effects-tab ${
                activeTab === "modulation" ? "active" : ""
              }`}
              onClick={() => setActiveTab("modulation")}
            >
              <Waves size={14} />
              Modulation
            </button>
            <button
              className={`effects-tab ${
                activeTab === "reverb" ? "active" : ""
              }`}
              onClick={() => setActiveTab("reverb")}
            >
              <Volume2 size={14} />
              Reverb
            </button>
            <button
              className={`effects-tab ${activeTab === "delay" ? "active" : ""}`}
              onClick={() => setActiveTab("delay")}
            >
              <Repeat size={14} />
              Delay
            </button>
            <button
              className={`effects-tab ${
                activeTab === "advanced" ? "active" : ""
              }`}
              onClick={() => setActiveTab("advanced")}
            >
              <Settings size={14} />
              Advanced
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="effects-content">
            {/* Presets Panel */}
            {activeTab === "presets" && effectsModalTrack && (
              <div className="effects-panel">
                <div className="presets-section">
                  <div className="presets-section-header">
                    <div className="presets-section-title">
                      Presets
                    </div>
                  </div>
                  
                  {!trackInfo?.hasPresets ? (
                    <div className="presets-empty">
                      <p>No presets available for this sound category.</p>
                      <p>You can still use the individual effect tabs to customize your sound.</p>
                    </div>
                  ) : (
                    <>
                      <div className="presets-grid">
                        {trackInfo.presets.map((preset) => {
                          const currentPreset = getCurrentPreset(effectsModalTrack.id);
                          const isActive = currentPreset && currentPreset.id === preset.id;
                          
                          return (
                            <button
                              key={preset.id}
                              className={`preset-card ${isActive ? 'active' : ''}`}
                              onClick={() => handleApplyPreset(preset.id)}
                            >
                              <div className="preset-name">{preset.name}</div>
                              <div className="preset-description">{preset.description}</div>
                              {isActive && <div className="preset-active-indicator">✓ Active</div>}
                            </button>
                          );
                        })}
                      </div>
                      
                      <div className="presets-info">
                        <p><strong>Tip:</strong> Presets set multiple effect parameters at once. You can still tweak individual effects in the other tabs after applying a preset.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* EQ Panel */}
            {activeTab === "eq" && (
              <div className="effects-panel">
                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <BarChart3 size={18} />
                      3-Band EQ
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('eq')}
                    >
                      <RotateCcw size={12} />
                      Reset EQ
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="High"
                      value={tempEffects.eq.high}
                      min={-12}
                      max={12}
                      unit="dB"
                      onChange={(value) =>
                        handleEffectChange("eq", "high", value)
                      }
                    />
                    <SliderControl
                      label="Mid"
                      value={tempEffects.eq.mid}
                      min={-12}
                      max={12}
                      unit="dB"
                      onChange={(value) =>
                        handleEffectChange("eq", "mid", value)
                      }
                    />
                    <SliderControl
                      label="Low"
                      value={tempEffects.eq.low}
                      min={-12}
                      max={12}
                      unit="dB"
                      onChange={(value) =>
                        handleEffectChange("eq", "low", value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Filter Panel */}
            {activeTab === "filter" && (
              <div className="effects-panel">
                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <Filter size={18} />
                      Low Pass Filter
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('filter')}
                    >
                      <RotateCcw size={12} />
                      Reset Filter
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="Cutoff"
                      value={tempEffects.filter.frequency}
                      min={100}
                      max={20000}
                      unit="Hz"
                      logarithmic={true}
                      onChange={(value) =>
                        handleEffectChange("filter", "frequency", value)
                      }
                    />
                    <SliderControl
                      label="Resonance"
                      value={tempEffects.filter.Q}
                      min={0.1}
                      max={30}
                      unit=""
                      onChange={(value) =>
                        handleEffectChange("filter", "Q", value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Reverb Panel */}
            {activeTab === "reverb" && (
              <div className="effects-panel">
                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <Volume2 size={18} />
                      Reverb
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('reverb')}
                    >
                      <RotateCcw size={12} />
                      Reset Reverb
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="Room Size"
                      value={tempEffects.reverb.roomSize}
                      min={0.1}
                      max={0.9}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("reverb", "roomSize", value)
                      }
                    />
                    <SliderControl
                      label="Decay"
                      value={tempEffects.reverb.decay}
                      min={0.1}
                      max={10}
                      unit="s"
                      onChange={(value) =>
                        handleEffectChange("reverb", "decay", value)
                      }
                    />
                    <SliderControl
                      label="Wet Level"
                      value={tempEffects.reverb.wet}
                      min={0}
                      max={1}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("reverb", "wet", value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Delay Panel */}
            {activeTab === "delay" && (
              <div className="effects-panel">
                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <Repeat size={18} />
                      Delay
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('delay')}
                    >
                      <RotateCcw size={12} />
                      Reset Delay
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="Time"
                      value={tempEffects.delay.delayTime}
                      min={0.01}
                      max={1}
                      unit="s"
                      onChange={(value) =>
                        handleEffectChange("delay", "delayTime", value)
                      }
                    />
                    <SliderControl
                      label="Feedback"
                      value={tempEffects.delay.feedback}
                      min={0}
                      max={0.95}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("delay", "feedback", value)
                      }
                    />
                    <SliderControl
                      label="Wet Level"
                      value={tempEffects.delay.wet}
                      min={0}
                      max={1}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("delay", "wet", value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dynamics Panel */}
            {activeTab === "dynamics" && (
              <div className="effects-panel">
                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <Zap size={18} />
                      Compressor
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('compressor')}
                    >
                      <RotateCcw size={12} />
                      Reset Compressor
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="Threshold"
                      value={tempEffects.compressor.threshold}
                      min={-60}
                      max={0}
                      unit="dB"
                      onChange={(value) =>
                        handleEffectChange("compressor", "threshold", value)
                      }
                    />
                    <SliderControl
                      label="Ratio"
                      value={tempEffects.compressor.ratio}
                      min={1}
                      max={20}
                      unit=":1"
                      onChange={(value) =>
                        handleEffectChange("compressor", "ratio", value)
                      }
                    />
                    <SliderControl
                      label="Attack"
                      value={tempEffects.compressor.attack}
                      min={0}
                      max={0.1}
                      unit="s"
                      onChange={(value) =>
                        handleEffectChange("compressor", "attack", value)
                      }
                    />
                    <SliderControl
                      label="Release"
                      value={tempEffects.compressor.release}
                      min={0.01}
                      max={1}
                      unit="s"
                      onChange={(value) =>
                        handleEffectChange("compressor", "release", value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modulation Panel */}
            {activeTab === "modulation" && (
              <div className="effects-panel">
                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <Waves size={18} />
                      Chorus
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('chorus')}
                    >
                      <RotateCcw size={12} />
                      Reset Chorus
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="Rate"
                      value={tempEffects.chorus.rate}
                      min={0.1}
                      max={10}
                      unit="Hz"
                      onChange={(value) =>
                        handleEffectChange("chorus", "rate", value)
                      }
                    />
                    <SliderControl
                      label="Depth"
                      value={tempEffects.chorus.depth}
                      min={0}
                      max={1}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("chorus", "depth", value)
                      }
                    />
                    <SliderControl
                      label="Wet Level"
                      value={tempEffects.chorus.wet}
                      min={0}
                      max={1}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("chorus", "wet", value)
                      }
                    />
                  </div>
                </div>

                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <Waves size={18} />
                      Vibrato
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('vibrato')}
                    >
                      <RotateCcw size={12} />
                      Reset Vibrato
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="Rate"
                      value={tempEffects.vibrato.rate}
                      min={0.1}
                      max={20}
                      unit="Hz"
                      onChange={(value) =>
                        handleEffectChange("vibrato", "rate", value)
                      }
                    />
                    <SliderControl
                      label="Depth"
                      value={tempEffects.vibrato.depth}
                      min={0}
                      max={1}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("vibrato", "depth", value)
                      }
                    />
                    <SliderControl
                      label="Wet Level"
                      value={tempEffects.vibrato.wet}
                      min={0}
                      max={1}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("vibrato", "wet", value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Panel */}
            {activeTab === "advanced" && (
              <div className="effects-panel">
                {/* CPU Warning */}
                <div className="effects-warning">
                  ⚠️ <strong>Performance Warning:</strong> These effects are CPU
                  intensive and may cause audio dropouts on slower devices.
                </div>

                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <Zap size={18} />
                      Distortion
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('distortion')}
                    >
                      <RotateCcw size={12} />
                      Reset Distortion
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="Drive"
                      value={tempEffects.distortion.amount}
                      min={0}
                      max={1}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("distortion", "amount", value)
                      }
                    />
                    <div className="slider-control">
                      <div className="slider-label">Quality</div>
                      <select
                        className="effects-select"
                        value={tempEffects.distortion.oversample}
                        onChange={(e) =>
                          handleEffectChange(
                            "distortion",
                            "oversample",
                            e.target.value
                          )
                        }
                      >
                        <option value="2x">2x</option>
                        <option value="4x">4x</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="effects-section">
                  <div className="effects-section-header">
                    <div className="effects-section-title">
                      <Settings size={18} />
                      Pitch Shift
                    </div>
                    <button 
                      className="effect-reset-btn"
                      onClick={() => handleResetEffect('pitchShift')}
                    >
                      <RotateCcw size={12} />
                      Reset Pitch Shift
                    </button>
                  </div>
                  <div className="slider-row">
                    <SliderControl
                      label="Pitch"
                      value={tempEffects.pitchShift.pitch}
                      min={-12}
                      max={12}
                      unit=" st"
                      onChange={(value) =>
                        handleEffectChange("pitchShift", "pitch", value)
                      }
                    />
                    <SliderControl
                      label="Window"
                      value={tempEffects.pitchShift.windowSize}
                      min={0.01}
                      max={0.1}
                      unit="s"
                      onChange={(value) =>
                        handleEffectChange("pitchShift", "windowSize", value)
                      }
                    />
                    <SliderControl
                      label="Wet Level"
                      value={tempEffects.pitchShift.wet}
                      min={0}
                      max={1}
                      unit="%"
                      percentage={true}
                      onChange={(value) =>
                        handleEffectChange("pitchShift", "wet", value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="effects-modal-footer">
          <div className="effects-footer-left">
            <button
              className="effects-btn effects-btn--danger"
              onClick={handleReset}
            >
              Reset All Effects
            </button>
            {effectsModalTrack && hasPendingChanges(effectsModalTrack.id) && (
              <div className="pending-changes-indicator">
                <span>•</span> Unsaved changes
              </div>
            )}
          </div>
          <div className="effects-footer-right">
            <button
              className="effects-btn effects-btn--secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className={`effects-btn effects-btn--primary ${
                effectsModalTrack && hasPendingChanges(effectsModalTrack.id) 
                  ? 'has-pending-changes' : ''
              }`}
              onClick={handleApply}
              disabled={effectsModalTrack && !hasPendingChanges(effectsModalTrack.id)}
            >
              {effectsModalTrack && hasPendingChanges(effectsModalTrack.id) ? 'Apply Changes' : 'No Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple Slider Control Component (no knobs)
function SliderControl({
  label,
  value,
  min,
  max,
  unit,
  percentage,
  logarithmic,
  onChange,
}) {
  const formatValue = (val) => {
    if (percentage) {
      return `${Math.round(val * 100)}%`;
    }
    if (unit === "Hz" && val >= 1000) {
      return `${(val / 1000).toFixed(1)}kHz`;
    }
    if (unit === "dB") {
      return `${val >= 0 ? "+" : ""}${val.toFixed(1)}dB`;
    }
    return `${val.toFixed(1)}${unit}`;
  };

  // Convert value to slider range (0-100 for easier handling)
  const getSliderValue = () => {
    if (logarithmic) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      const logValue = Math.log(value);
      return ((logValue - logMin) / (logMax - logMin)) * 100;
    } else {
      return ((value - min) / (max - min)) * 100;
    }
  };

  // Convert slider value (0-100) back to actual value
  const getActualValue = (sliderVal) => {
    const normalizedVal = sliderVal / 100; // 0-1 range

    if (logarithmic) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      return Math.exp(logMin + normalizedVal * (logMax - logMin));
    } else {
      return min + normalizedVal * (max - min);
    }
  };

  const handleSliderChange = (e) => {
    const sliderValue = parseFloat(e.target.value);
    const actualValue = getActualValue(sliderValue);

    // Round to reasonable precision
    const range = max - min;
    const precision = range < 10 ? 100 : range < 100 ? 10 : 1;
    const roundedValue = Math.round(actualValue * precision) / precision;

    onChange(roundedValue);
  };

  return (
    <div className="slider-control">
      <div className="slider-label">{label}</div>

      {/* Slider for control */}
      <input
        type="range"
        className="effects-slider"
        min="0"
        max="100"
        step="0.1"
        value={getSliderValue()}
        onChange={handleSliderChange}
      />

      {/* Value display */}
      <div className="slider-value">{formatValue(value)}</div>
    </div>
  );
}

export default EffectsModal;
