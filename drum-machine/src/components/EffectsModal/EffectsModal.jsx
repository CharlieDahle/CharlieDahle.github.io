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

  // Handle knob changes (real-time updates)
  const handleEffectChange = (effectType, parameter, value) => {
    const newEffects = {
      ...tempEffects,
      [effectType]: {
        ...tempEffects[effectType],
        [parameter]: value,
      },
    };
    setTempEffects(newEffects);

    // Apply change immediately for real-time feedback
    updateTrackEffect(effectsModalTrack.id, effectType, parameter, value);
  };

  // Handle Apply - commit the changes
  const handleApply = () => {
    // Changes are already applied in real-time, just close modal
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

// Knob Control Component
// Simple Input Control Component - much easier!
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
      return Math.round(val * 100);
    }
    if (unit === "Hz" && val >= 1000) {
      return (val / 1000).toFixed(1);
    }
    if (unit === "dB") {
      return val.toFixed(1);
    }
    return val.toFixed(1);
  };

  const parseValue = (inputVal) => {
    let numValue = parseFloat(inputVal);

    if (isNaN(numValue)) return value; // Keep current value if invalid

    if (percentage) {
      numValue = numValue / 100; // Convert percentage back to 0-1 range
    }

    if (unit === "Hz" && inputVal.includes("k")) {
      numValue = numValue * 1000; // Convert kHz to Hz
    }

    // Clamp to min/max
    return Math.max(min, Math.min(max, numValue));
  };

  const getUnit = () => {
    if (percentage) return "%";
    if (unit === "Hz" && value >= 1000) return "kHz";
    return unit;
  };

  const handleInputChange = (e) => {
    const newValue = parseValue(e.target.value);
    onChange(newValue);
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

  return (
    <div className="knob-control">
      <div className="knob-label">{label}</div>

      {/* Visual knob - not interactive, just shows the value */}
      <div
        className="knob knob--display-only"
        style={{ "--knob-rotation": `${getRotation()}deg` }}
      />

      {/* Input field for actual control */}
      <div className="knob-input-container">
        <input
          type="number"
          className="knob-input"
          value={formatValue(value)}
          onChange={handleInputChange}
          step={unit === "dB" ? "0.1" : "1"}
          min={percentage ? 0 : min}
          max={percentage ? 100 : max}
        />
        <span className="knob-unit">{getUnit()}</span>
      </div>
    </div>
  );
}

export default EffectsModal;
