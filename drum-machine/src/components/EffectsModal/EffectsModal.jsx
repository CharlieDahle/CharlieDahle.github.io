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

  const [activeTab, setActiveTab] = useState("eq");
  const [tempEffects, setTempEffects] = useState(null);
  const [originalEffects, setOriginalEffects] = useState(null);

  // Load current effects when modal opens
  useEffect(() => {
    if (effectsModalOpen && effectsModalTrack) {
      const currentEffects = getTrackEffects(effectsModalTrack.id);
      setTempEffects({ ...currentEffects });
      setOriginalEffects({ ...currentEffects });
      setActiveTab("eq");
    }
  }, [effectsModalOpen, effectsModalTrack, getTrackEffects]);

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

  // Handle Apply - NOW we broadcast the changes
  const handleApply = () => {
    if (effectsModalTrack && tempEffects) {
      // Get the enabled effects (non-default values only)
      const enabledEffects = {};

      Object.keys(tempEffects).forEach((effectType) => {
        const settings = tempEffects[effectType];

        // Check if this effect is enabled (has non-default values)
        let isEnabled = false;
        switch (effectType) {
          case "eq":
            isEnabled =
              settings.high !== 0 || settings.mid !== 0 || settings.low !== 0;
            break;
          case "filter":
            isEnabled = settings.frequency !== 20000 || settings.Q !== 1;
            break;
          case "compressor":
            isEnabled =
              settings.threshold !== -24 ||
              settings.ratio !== 4 ||
              settings.attack !== 0.01 ||
              settings.release !== 0.1;
            break;
          case "chorus":
          case "vibrato":
          case "reverb":
          case "delay":
            isEnabled = settings.wet > 0;
            break;
          case "distortion":
            isEnabled = settings.amount > 0;
            break;
          case "pitchShift":
            isEnabled = settings.wet > 0 || settings.pitch !== 0;
            break;
        }

        // Only include enabled effects
        if (isEnabled) {
          enabledEffects[effectType] = settings;
        }
      });

      console.log(
        `Applying effects for ${effectsModalTrack.name}:`,
        enabledEffects
      );

      // Send the enabled effects chain to trigger rebuild
      const { websocket } = useAppStore.getState();
      websocket.sendEffectChainUpdate(effectsModalTrack.id, enabledEffects);

      // Also update local state for immediate feedback
      const { effects } = useAppStore.getState();
      effects.setTrackEffectChain(effectsModalTrack.id, enabledEffects);
    }

    closeEffectsModal();
  };

  // Handle Cancel - revert to original settings
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
    }
    closeEffectsModal();
  };

  // Handle Reset - reset to defaults
  const handleReset = () => {
    if (effectsModalTrack) {
      resetTrackEffects(effectsModalTrack.id);
      const resetEffects = getTrackEffects(effectsModalTrack.id);
      setTempEffects({ ...resetEffects });
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
            <span>{effectsModalTrack.name}</span> Effects
          </h3>
          <button className="effects-close-btn" onClick={handleCancel}>
            &times;
          </button>
        </div>

        <div className="effects-modal-body">
          {/* Effect Tabs */}
          <div className="effects-tabs">
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
            {/* EQ Panel */}
            {activeTab === "eq" && (
              <div className="effects-panel">
                <div className="effects-section">
                  <div className="effects-section-title">
                    <BarChart3 size={18} />
                    3-Band EQ
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
                  <div className="effects-section-title">
                    <Filter size={18} />
                    Low Pass Filter
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
                  <div className="effects-section-title">
                    <Volume2 size={18} />
                    Reverb
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
                  <div className="effects-section-title">
                    <Repeat size={18} />
                    Delay
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
                  <div className="effects-section-title">
                    <Zap size={18} />
                    Compressor
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
                  <div className="effects-section-title">
                    <Waves size={18} />
                    Chorus
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
                  <div className="effects-section-title">
                    <Waves size={18} />
                    Vibrato
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
                  <div className="effects-section-title">
                    <Zap size={18} />
                    Distortion
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
                  <div className="effects-section-title">
                    <Settings size={18} />
                    Pitch Shift
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
          <button
            className="effects-btn effects-btn--danger"
            onClick={handleReset}
          >
            Reset
          </button>
          <div className="button-spacer"></div>
          <button
            className="effects-btn effects-btn--secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="effects-btn effects-btn--primary"
            onClick={handleApply}
          >
            Apply
          </button>
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
