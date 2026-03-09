// src/components/VisibilityToggle/VisibilityToggle.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Globe, Lock, EyeOff } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import "./VisibilityToggle.css";

function VisibilityToggle() {
  const [visibility, setVisibility] = useState("private");
  const [isChanging, setIsChanging] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const getAuthHeaders = useAppStore((state) => state.auth.getAuthHeaders);

  // Get beatId from URL params
  const { beatId } = useParams();

  // Load current visibility when component mounts or beatId changes
  useEffect(() => {
    const fetchVisibility = async () => {
      if (!beatId || !isAuthenticated) return;

      try {
        const response = await fetch(`/api/beats/${beatId}/access`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          setVisibility(data.visibility || "private");
        }
      } catch (err) {
        console.error("Error fetching visibility:", err);
      }
    };

    fetchVisibility();
  }, [beatId, isAuthenticated]);

  const handleVisibilityChange = async (newVisibility) => {
    if (newVisibility === visibility || isChanging) return;

    try {
      setIsChanging(true);
      setShowDropdown(false);

      const response = await fetch(`/api/beats/${beatId}/visibility`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (!response.ok) {
        throw new Error("Failed to update visibility");
      }

      setVisibility(newVisibility);
      console.log(`✅ Beat visibility changed to: ${newVisibility}`);
    } catch (err) {
      console.error("Error updating visibility:", err);
      alert("Failed to update visibility. Please try again.");
    } finally {
      setIsChanging(false);
    }
  };

  const getVisibilityIcon = () => {
    switch (visibility) {
      case "public":
        return <Globe size={16} />;
      case "unlisted":
        return <EyeOff size={16} />;
      case "private":
      default:
        return <Lock size={16} />;
    }
  };

  const getVisibilityLabel = () => {
    switch (visibility) {
      case "public":
        return "Public";
      case "unlisted":
        return "Unlisted";
      case "private":
      default:
        return "Private";
    }
  };

  if (!isAuthenticated || !beatId) {
    return null;
  }

  return (
    <div className="visibility-toggle">
      <button
        className={`visibility-button visibility-button--${visibility}`}
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isChanging}
        title="Change beat visibility"
      >
        {getVisibilityIcon()}
        <span>{getVisibilityLabel()}</span>
        <span className="dropdown-arrow">▼</span>
      </button>

      {showDropdown && (
        <>
          <div
            className="visibility-backdrop"
            onClick={() => setShowDropdown(false)}
          />
          <div className="visibility-dropdown">
            <button
              className={`visibility-option ${
                visibility === "public" ? "visibility-option--active" : ""
              }`}
              onClick={() => handleVisibilityChange("public")}
            >
              <Globe size={16} />
              <div className="visibility-option-content">
                <strong>Public</strong>
                <span>Anyone can view, shows in gallery</span>
              </div>
            </button>

            <button
              className={`visibility-option ${
                visibility === "unlisted" ? "visibility-option--active" : ""
              }`}
              onClick={() => handleVisibilityChange("unlisted")}
            >
              <EyeOff size={16} />
              <div className="visibility-option-content">
                <strong>Unlisted</strong>
                <span>Anyone with link can view</span>
              </div>
            </button>

            <button
              className={`visibility-option ${
                visibility === "private" ? "visibility-option--active" : ""
              }`}
              onClick={() => handleVisibilityChange("private")}
            >
              <Lock size={16} />
              <div className="visibility-option-content">
                <strong>Private</strong>
                <span>Only you can access</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default VisibilityToggle;
