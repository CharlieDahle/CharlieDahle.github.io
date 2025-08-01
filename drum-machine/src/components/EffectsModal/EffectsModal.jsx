import React, { useState, useEffect, useRef, useCallback } from "react";
import { Sliders, BarChart3, Filter, Volume2, Repeat } from "lucide-react";
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
    // Send all the changes to WebSocket for collaboration
    if (originalEffects && effectsModalTrack) {
      Object.keys(tempEffects).forEach((effectType) => {
        Object.keys(tempEffects[effectType]).forEach((parameter) => {
          const newValue = tempEffects[effectType][parameter];
          const originalValue = originalEffects[effectType][parameter];

          // Only broadcast if the value actually changed
          if (newValue !== originalValue) {
            // This will broadcast to other users
            get().websocket.sendEffectChange(
              effectsModalTrack.id,
              effectType,
              parameter,
              newValue
            );
          }
        });
      });
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
              <BarChart3 size={16} />
              EQ
            </button>
            <button
              className={`effects-tab ${
                activeTab === "filter" ? "active" : ""
              }`}
              onClick={() => setActiveTab("filter")}
            >
              <Filter size={16} />
              Filter
            </button>
            <button
              className={`effects-tab ${
                activeTab === "reverb" ? "active" : ""
              }`}
              onClick={() => setActiveTab("reverb")}
            >
              <Volume2 size={16} />
              Reverb
            </button>
            <button
              className={`effects-tab ${activeTab === "delay" ? "active" : ""}`}
              onClick={() => setActiveTab("delay")}
            >
              <Repeat size={16} />
              Delay
            </button>
          </div>

          {/* EQ Panel */}
          {activeTab === "eq" && (
            <div className="effects-panel">
              <div className="effects-section">
                <div className="effects-section-title">
                  <BarChart3 size={18} />
                  3-Band EQ
                </div>
                <div className="knob-row">
                  <KnobControl
                    label="High"
                    value={tempEffects.eq.high}
                    min={-12}
                    max={12}
                    unit="dB"
                    onChange={(value) =>
                      handleEffectChange("eq", "high", value)
                    }
                  />
                  <KnobControl
                    label="Mid"
                    value={tempEffects.eq.mid}
                    min={-12}
                    max={12}
                    unit="dB"
                    onChange={(value) => handleEffectChange("eq", "mid", value)}
                  />
                  <KnobControl
                    label="Low"
                    value={tempEffects.eq.low}
                    min={-12}
                    max={12}
                    unit="dB"
                    onChange={(value) => handleEffectChange("eq", "low", value)}
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
                <div className="knob-row">
                  <KnobControl
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
                  <KnobControl
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
                <div className="knob-row">
                  <KnobControl
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
                  <KnobControl
                    label="Decay"
                    value={tempEffects.reverb.decay}
                    min={0.1}
                    max={10}
                    unit="s"
                    onChange={(value) =>
                      handleEffectChange("reverb", "decay", value)
                    }
                  />
                  <KnobControl
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
                <div className="knob-row">
                  <KnobControl
                    label="Time"
                    value={tempEffects.delay.delayTime}
                    min={0.01}
                    max={1}
                    unit="s"
                    onChange={(value) =>
                      handleEffectChange("delay", "delayTime", value)
                    }
                  />
                  <KnobControl
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
                  <KnobControl
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
        </div>

        <div className="effects-modal-footer">
          <button
            className="effects-btn effects-btn--secondary"
            onClick={handleReset}
          >
            Reset
          </button>
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

// Simple Slider Control Component
function KnobControl({
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

  // Calculate rotation for visual knob (still show it, just not interactive)
  const getRotation = () => {
    let percentage;
    if (logarithmic) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      const logValue = Math.log(value);
      percentage = (logValue - logMin) / (logMax - logMin);
    } else {
      percentage = (value - min) / (max - min);
    }
    return (percentage - 0.5) * 270; // -135deg to +135deg
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
    <div className="knob-control">
      <div className="knob-label">{label}</div>

      {/* Visual knob - not interactive, just shows the value */}
      <div
        className="knob knob--display-only"
        style={{ "--knob-rotation": `${getRotation()}deg` }}
      />

      {/* Slider for actual control */}
      <input
        type="range"
        className="knob-slider"
        min="0"
        max="100"
        step="0.1"
        value={getSliderValue()}
        onChange={handleSliderChange}
      />

      {/* Value display */}
      <div className="knob-value">{formatValue(value)}</div>
    </div>
  );
}

export default EffectsModal;
