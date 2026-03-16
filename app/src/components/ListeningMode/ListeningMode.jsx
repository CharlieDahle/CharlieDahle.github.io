// src/components/ListeningMode/ListeningMode.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, AlertCircle } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import PatternTimeline from "../PatternTimeline/PatternTimeline.jsx";
import TransportControls from "../TransportControls/TransportControls.jsx";
import DrumScheduler from "../DrumScheduler/DrumScheduler.jsx";
import styles from "./ListeningMode.module.css";

/**
 * ListeningMode Component
 *
 * Purpose: Static playback of saved beat without active session
 * Renders when: User visits public/unlisted beat with no active session
 * Features:
 * - Loads beat data from API
 * - Local playback controls (play/pause)
 * - Displays beat pattern (read-only)
 * - "Request to Edit" button (joins queue)
 * - No WebSocket connection
 */
function ListeningMode({ beatId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [beatData, setBeatData] = useState(null);

  // Get store actions for loading beat
  const setTracks = useAppStore((state) => state.tracks?.setTracks);
  const setPattern = useAppStore((state) => state.pattern?.setPattern);
  const setBpm = useAppStore((state) => state.transport?.setBpm);
  const setMeasureCount = useAppStore((state) => state.transport?.setMeasureCount);

  // Transport state for local playback
  const isPlaying = useAppStore((state) => state.transport?.isPlaying);
  const bpm = useAppStore((state) => state.transport?.bpm);

  // Load beat data from API
  useEffect(() => {
    const loadBeat = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`https://api.charliedahle.me/api/beats/${beatId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Beat not found");
          }
          throw new Error("Failed to load beat");
        }

        const data = await response.json();
        setBeatData(data);

        // Load beat data into store for local playback
        setPattern(data.pattern_data || {});
        setBpm(data.bpm || 120);
        setMeasureCount(data.measure_count || 4);
        setTracks(data.tracks_config || []);

      } catch (err) {
        console.error("Error loading beat:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBeat();
  }, [beatId, setPattern, setBpm, setMeasureCount, setTracks]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading beat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle size={48} />
          <h2>Failed to Load Beat</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Listening Mode Banner */}
      <motion.div
        className={styles.banner}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.bannerContent}>
          <div className={styles.bannerLeft}>
            <div className={styles.statusDot}></div>
            <span className={styles.bannerText}>Listening Mode</span>
            <span className={styles.bannerSubtext}>
              {beatData?.name || "Untitled Beat"}
            </span>
          </div>
          <div className={styles.bannerRight}>
            <button className={styles.requestButton}>
              Request to Edit
            </button>
          </div>
        </div>
      </motion.div>

      {/* Beat Info */}
      <div className={styles.beatInfo}>
        <h2 className={styles.beatName}>{beatData?.name || "Untitled Beat"}</h2>
        <div className={styles.beatMeta}>
          <span>{bpm} BPM</span>
          <span>•</span>
          <span>{beatData?.measure_count || 4} measures</span>
        </div>
      </div>

      {/* Pattern Display (Read-Only) */}
      <div className={styles.patternContainer}>
        <PatternTimeline disabled={true} />
      </div>

      {/* Local Transport Controls */}
      <div className={styles.transportContainer}>
        <TransportControls localMode={true} />
      </div>

      {/* Hidden DrumScheduler for audio playback */}
      <DrumScheduler />

      {/* Info Message */}
      <motion.div
        className={styles.infoMessage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p>
          You're listening to a static version of this beat.
          Request edit access to collaborate in real-time.
        </p>
      </motion.div>
    </div>
  );
}

export default ListeningMode;
