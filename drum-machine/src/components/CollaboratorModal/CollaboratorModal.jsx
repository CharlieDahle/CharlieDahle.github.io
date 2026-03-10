// src/components/CollaboratorModal/CollaboratorModal.jsx
import React, { useState, useEffect } from "react";
import { X, UserPlus, Trash2, Star, User, Pencil } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import "./CollaboratorModal.css";

function CollaboratorModal({ beat, onClose }) {
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addUsername, setAddUsername] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [roleMenuId, setRoleMenuId] = useState(null);
  const [changingRoleId, setChangingRoleId] = useState(null);

  const getAuthHeaders = useAppStore((state) => state.auth.getAuthHeaders);
  const currentUserId = useAppStore((state) => state.auth.user?.id);

  const fetchCollaborators = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`https://api.charliedahle.me/api/beats/${beat.id}/collaborators`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setCollaborators(data.collaborators);
      }
    } catch (err) {
      console.error("Failed to fetch collaborators:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
  }, [beat.id]);

  // Close role menu on outside click
  useEffect(() => {
    if (!roleMenuId) return;
    const handler = (e) => {
      if (!e.target.closest(".collab-role-cell")) setRoleMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [roleMenuId]);

  const handleAdd = async () => {
    if (!addUsername.trim()) return;
    setAddError("");
    setIsAdding(true);

    try {
      const searchRes = await fetch(
        `/api/users/search?username=${encodeURIComponent(addUsername.trim())}`,
        { headers: getAuthHeaders() }
      );
      const searchData = await searchRes.json();

      if (!searchRes.ok || !searchData.users?.length) {
        setAddError("User not found.");
        return;
      }

      const match = searchData.users.find(
        (u) => u.username.toLowerCase() === addUsername.trim().toLowerCase()
      );
      if (!match) {
        setAddError("No exact match. Check the username.");
        return;
      }

      if (collaborators.some((c) => c.user_id === match.id)) {
        setAddError("This user is already a collaborator.");
        return;
      }

      const addRes = await fetch(`https://api.charliedahle.me/api/beats/${beat.id}/collaborators`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ userId: match.id, role: "collaborator" }),
      });

      if (!addRes.ok) {
        const data = await addRes.json().catch(() => ({}));
        setAddError(data.error || "Failed to add collaborator.");
        return;
      }

      setAddUsername("");
      await fetchCollaborators();
    } catch (err) {
      setAddError("Something went wrong. Try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (userId) => {
    try {
      const res = await fetch(`https://api.charliedahle.me/api/beats/${beat.id}/collaborators/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setConfirmRemoveId(null);
        await fetchCollaborators();
      }
    } catch (err) {
      console.error("Failed to remove collaborator:", err);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    setChangingRoleId(userId);
    setRoleMenuId(null);
    // Optimistically update local state
    setCollaborators((prev) =>
      prev.map((c) => (c.user_id === userId ? { ...c, role: newRole } : c))
    );
    try {
      const res = await fetch(`https://api.charliedahle.me/api/beats/${beat.id}/collaborators`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      // Roll back on failure
      if (!res.ok) {
        setCollaborators((prev) =>
          prev.map((c) => (c.user_id === userId ? { ...c, role: newRole === "owner" ? "collaborator" : "owner" } : c))
        );
      }
    } catch (err) {
      console.error("Failed to change role:", err);
      setCollaborators((prev) =>
        prev.map((c) => (c.user_id === userId ? { ...c, role: newRole === "owner" ? "collaborator" : "owner" } : c))
      );
    } finally {
      setChangingRoleId(null);
    }
  };

  const ownerCount = collaborators.filter((c) => c.role === "owner").length;
  const currentUserIsOwner = collaborators.some(
    (c) => c.user_id === currentUserId && c.role === "owner"
  );

  return (
    <div className="collab-modal-overlay" onClick={onClose}>
      <div className="collab-modal" onClick={(e) => e.stopPropagation()}>
        <div className="collab-modal-header">
          <div className="collab-modal-title">
            <h2>Collaborators</h2>
            <span className="collab-beat-name">"{beat.name}"</span>
          </div>
          <button className="collab-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="collab-modal-body">
          {isLoading ? (
            <div className="collab-loading">
              <div className="collab-spinner" />
              Loading...
            </div>
          ) : (
            <ul className="collab-list">
              {collaborators.map((c) => {
                const isYou = c.user_id === currentUserId;
                const cantRemove = c.role === "owner" && ownerCount <= 1;
                const cantDemote = c.role === "owner" && ownerCount <= 1;

                return (
                  <li key={c.user_id} className="collab-item">
                    <div className="collab-user">
                      {c.role === "owner" ? (
                        <Star size={15} className="collab-icon collab-icon--owner" />
                      ) : (
                        <User size={15} className="collab-icon" />
                      )}
                      <span className="collab-username">
                        {c.username}
                        {isYou && <span className="collab-you"> (you)</span>}
                      </span>
                      <span className={`collab-role-badge collab-role-badge--${c.role}`}>
                        {c.role}
                      </span>
                    </div>

                    {!isYou && (
                      <div className="collab-actions">
                        {/* Role edit — pencil opens dropdown */}
                        {currentUserIsOwner && (
                          <div className="collab-role-cell">
                            <button
                              className="collab-edit-role-btn"
                              onClick={() => setRoleMenuId(roleMenuId === c.user_id ? null : c.user_id)}
                              disabled={changingRoleId === c.user_id}
                              title="Change role"
                            >
                              <Pencil size={13} />
                            </button>
                            {roleMenuId === c.user_id && (
                              <div className="collab-role-menu">
                                {["collaborator", "owner"].map((role) => (
                                  <button
                                    key={role}
                                    className={`collab-role-menu-item ${c.role === role ? "collab-role-menu-item--active" : ""}`}
                                    onClick={() => {
                                      if (role === c.role) { setRoleMenuId(null); return; }
                                      if (cantDemote && role === "collaborator") return;
                                      handleChangeRole(c.user_id, role);
                                    }}
                                    disabled={cantDemote && role === "collaborator"}
                                    title={cantDemote && role === "collaborator" ? "Cannot demote the last owner" : ""}
                                  >
                                    {role === "owner"
                                      ? <Star size={13} />
                                      : <User size={13} />
                                    }
                                    {role}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Remove */}
                        {confirmRemoveId === c.user_id ? (
                          <div className="collab-confirm">
                            <span>Remove?</span>
                            <button className="collab-confirm-yes" onClick={() => handleRemove(c.user_id)}>Yes</button>
                            <button className="collab-confirm-no" onClick={() => setConfirmRemoveId(null)}>No</button>
                          </div>
                        ) : (
                          <button
                            className="collab-remove-btn"
                            onClick={() => setConfirmRemoveId(c.user_id)}
                            disabled={cantRemove}
                            title={cantRemove ? "Cannot remove the last owner" : "Remove collaborator"}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add collaborator */}
          <div className="collab-add-section">
            <div className="collab-add-row">
              <input
                type="text"
                className="collab-add-input"
                placeholder="Add by username..."
                value={addUsername}
                onChange={(e) => { setAddUsername(e.target.value); setAddError(""); }}
                onKeyDown={(e) => e.key === "Enter" && !isAdding && handleAdd()}
                disabled={isAdding}
              />
              <button
                className="collab-add-btn"
                onClick={handleAdd}
                disabled={!addUsername.trim() || isAdding}
              >
                <UserPlus size={16} />
                {isAdding ? "Adding..." : "Add"}
              </button>
            </div>
            {addError && <p className="collab-add-error">{addError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollaboratorModal;
