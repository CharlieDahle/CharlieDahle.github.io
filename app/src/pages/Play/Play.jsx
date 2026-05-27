import { useEffect, useRef, useCallback, useState } from "react";
import Matter from "matter-js";
import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import "./Play.css";

// --- Constants ---
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const KEYS       = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const NOTE_COLORS = {
  C:"#FF6B6B", "C#":"#FF8E53", D:"#FF9F43", "D#":"#FFC048",
  E:"#FECA57", F:"#54A0FF",   "F#":"#48DBFB", G:"#5F27CD",
  "G#":"#00D2D3", A:"#FF9FF3", "A#":"#1DD1A1", B:"#C8D6E5",
};

const PRESETS = {
  "Major Scale":  [0,2,4,5,7,9,11],
  "Minor Scale":  [0,2,3,5,7,8,10],
  "Pentatonic":   [0,2,4,7,9],
  "Blues":        [0,3,5,6,7,10],
  "Major Chord":  [0,4,7],
  "Minor Chord":  [0,3,7],
  "Dom 7":        [0,4,7,10],
  "Maj 7":        [0,4,7,11],
};

const SYNTH_PRESETS = {
  "Triangle": () => new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 2.0 },
  }),
  "Sine": () => new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.5, sustain: 0.2, release: 2.0 },
  }),
  "Saw": () => new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.8 },
  }),
  "Square": () => new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "square" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.15, release: 1.0 },
  }),
  "FM": () => new Tone.PolySynth(Tone.FMSynth, {
    modulationIndex: 10,
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 1.5 },
  }),
  "AM": () => new Tone.PolySynth(Tone.AMSynth, {
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 1.5 },
  }),
  "Pluck": () => new Tone.PluckSynth({ attackNoise: 2, dampening: 4000, resonance: 0.98 }),
  "Membrane": () => new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 4 }),
};

const WALL = 40, RADIUS = 24, BOUNCE = 0.85, MIN_VEL = 0.8, COOLDOWN = 80;
const D_W = 50, D_H = 34, D_NOZZLE = 12;
const LINE_THICKNESS = 8, LINE_LENGTH = 160, LINE_HANDLE_R = 10;

function buildNotes(root, preset) {
  const ri = NOTE_NAMES.indexOf(root);
  return PRESETS[preset].map(iv => {
    const idx = (ri + iv) % 12;
    const oct = 4 + Math.floor((ri + iv) / 12);
    return NOTE_NAMES[idx] + oct;
  });
}

function noteToMidi(noteStr) {
  const pc  = noteStr.replace(/\d+$/, "");
  const oct = parseInt(noteStr.match(/\d+$/)[0]);
  return 12 * (oct + 1) + NOTE_NAMES.indexOf(pc);
}

// ---

export default function Play() {
  const canvasRef  = useRef(null);
  const engineRef  = useRef(null);
  const synthRef   = useRef(null);
  const lastPlayedRef  = useRef({});
  const audioReadyRef  = useRef(false);
  const gravityModeRef = useRef("normal");
  const gravityBtnRef  = useRef(null);
  const volumeRef      = useRef(0.7);

  // Dispenser
  const dispenserRef      = useRef(null);
  const dispenserAngleRef = useRef(0);
  const angleLabelRef     = useRef(null);
  const dragRef = useRef({ active: false, ox: 0, oy: 0, moved: false });

  // Lines
  const linesRef          = useRef([]);
  const lineInteractRef   = useRef({ mode: null, line: null, ox: 0, oy: 0 });
  const hoveredLineRef    = useRef(null); // { line, part } where part: 'body'|'rotate'|'delete'

  // Sound / fire settings
  const rootKeyRef    = useRef("D");
  const presetRef     = useRef("Maj 7");
  const fireModeRef   = useRef("seq");
  const seqDelayRef   = useRef(180);  // ms, used only when seqDivRef = "free"
  const seqDivRef     = useRef("1/8"); // musical division or "free"
  const singleIdxRef  = useRef(0);
  const seqActiveRef  = useRef(false);
  const velLinkedRef  = useRef(false);

  // Transport / recording
  const bpmRef          = useRef(120);
  const timeSigRef      = useRef(4);
  const barCountRef     = useRef(4);
  const isRecordingRef  = useRef(false);
  const recordingRef    = useRef([]);
  const quantizeRef     = useRef(false);
  const beatDisplayRef  = useRef(null);
  const beatIntervalRef = useRef(null);
  const playbackPartRef       = useRef(null);
  const isPlayingBackRef      = useRef(false);
  const clickSynthRef         = useRef(null);
  const isLoopingRef          = useRef(false);
  const isArmedRef            = useRef(false);
  const armModeRef            = useRef(null); // "play" | "loop"
  const startFromTriggerRef   = useRef(null);
  const armFireTimeRef        = useRef(0);    // Date.now() when dispenser fired while armed

  // UI state (needs re-render)
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [isLooping,    setIsLooping]    = useState(false);
  const [hasMidi,      setHasMidi]      = useState(false);
  const [isPlayingBack,setIsPlayingBack]= useState(false);
  const [seqFree,      setSeqFree]      = useState(false);
  const [armedMode,    setArmedMode]    = useState(null); // null | "play" | "loop"

  // ---- Draw ----
  const drawScene = useCallback(() => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const body of Matter.Composite.allBodies(engine.world)) {
      if (body.isStatic) continue;
      const { x, y } = body.position;
      const pc = body.label.replace(/\d+$/, "");

      ctx.beginPath();
      ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = NOTE_COLORS[pc] || "#aaa";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = `bold ${Math.round(RADIUS * 0.52)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pc, x, y);
    }

    const d = dispenserRef.current;
    if (d) {
      const { x, y } = d.position;
      const angle = dispenserAngleRef.current;
      const hw = D_W / 2, hh = D_H / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-angle);

      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, D_W, D_H, 6);
      ctx.fill();

      const nw1 = D_W - 8;
      const nw2 = RADIUS * 2 + 4;
      ctx.fillStyle = "#444";
      ctx.beginPath();
      ctx.moveTo(-nw1 / 2, hh);
      ctx.lineTo( nw1 / 2, hh);
      ctx.lineTo( nw2 / 2, hh + D_NOZZLE);
      ctx.lineTo(-nw2 / 2, hh + D_NOZZLE);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-nw2 / 2, hh + D_NOZZLE);
      ctx.lineTo( nw2 / 2, hh + D_NOZZLE);
      ctx.stroke();

      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(0, hh + D_NOZZLE, nw2 / 2 - 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Draw lines
    for (const line of linesRef.current) {
      const { body } = line;
      const { x, y } = body.position;
      const ang = body.angle;
      const hw  = LINE_LENGTH / 2;
      const hovered = hoveredLineRef.current?.line === line;

      // Line body
      const baseColor    = line.isTrigger ? "#e8890c" : "#666";
      const hoveredColor = line.isTrigger ? "#c0710a" : "#444";
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.roundRect(-hw, -LINE_THICKNESS / 2, LINE_LENGTH, LINE_THICKNESS, LINE_THICKNESS / 2);
      ctx.fillStyle = hovered ? hoveredColor : baseColor;
      ctx.fill();
      ctx.restore();

      if (hovered) {
        // Delete handle — left end
        const delX = x - Math.cos(ang) * (hw + LINE_HANDLE_R + 2);
        const delY = y - Math.sin(ang) * (hw + LINE_HANDLE_R + 2);
        const delHot = hoveredLineRef.current?.part === "delete";
        ctx.beginPath();
        ctx.arc(delX, delY, LINE_HANDLE_R, 0, Math.PI * 2);
        ctx.fillStyle = delHot ? "#e74c3c" : "#c0392b";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("×", delX, delY);

        // Rotate handle — right end
        const rotX = x + Math.cos(ang) * (hw + LINE_HANDLE_R + 2);
        const rotY = y + Math.sin(ang) * (hw + LINE_HANDLE_R + 2);
        const rotHot = hoveredLineRef.current?.part === "rotate";
        ctx.beginPath();
        ctx.arc(rotX, rotY, LINE_HANDLE_R, 0, Math.PI * 2);
        ctx.fillStyle = rotHot ? "#bbb" : "#888";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("↻", rotX, rotY);
      }
    }
  }, []);

  // ---- Cull balls older than 2 bars ----
  const cullOldBalls = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const barMs = (60 / bpmRef.current) * timeSigRef.current * 1000;
    const cutoff = Date.now() - 2 * barMs;
    const toRemove = Matter.Composite.allBodies(engine.world)
      .filter(b => !b.isStatic && b.spawnedAt && b.spawnedAt < cutoff);
    if (toRemove.length) Matter.Composite.remove(engine.world, toRemove);
  }, []);

  // ---- Spawn one circle from nozzle ----
  const spawnCircle = useCallback((note, angle) => {
    if (!engineRef.current || !dispenserRef.current) return;
    const dist = D_H / 2 + D_NOZZLE + RADIUS + 2;
    const px = dispenserRef.current.position.x + Math.sin(angle) * dist;
    const py = dispenserRef.current.position.y + Math.cos(angle) * dist;
    const body = Matter.Bodies.circle(px, py, RADIUS, {
      restitution: BOUNCE, friction: 0.01, frictionAir: 0.005, label: note,
    });
    body.spawnedAt = Date.now();
    Matter.Body.setVelocity(body, {
      x: Math.sin(angle) * 5,
      y: Math.cos(angle) * 5,
    });
    Matter.Composite.add(engineRef.current.world, body);
  }, []);

  // ---- Fire ----
  const fire = useCallback(() => {
    if (!audioReadyRef.current) return;
    const notes = buildNotes(rootKeyRef.current, presetRef.current);
    const angle = dispenserAngleRef.current;
    const mode  = fireModeRef.current;

    if (mode === "burst") {
      notes.forEach((note, i) => {
        const spread = (i - (notes.length - 1) / 2) * 0.22;
        setTimeout(() => spawnCircle(note, angle + spread), i * 15);
      });
    } else if (mode === "single") {
      const note = notes[singleIdxRef.current % notes.length];
      singleIdxRef.current++;
      spawnCircle(note, angle);
    } else if (mode === "seq") {
      if (seqActiveRef.current) return;
      seqActiveRef.current = true;
      const DIV_BEATS = { "1/4": 1, "1/8": 0.5, "1/16": 0.25, "1/32": 0.125 };
      const stepMs = seqDivRef.current === "free"
        ? seqDelayRef.current
        : (60 / bpmRef.current) * (DIV_BEATS[seqDivRef.current] ?? 0.5) * 1000;
      notes.forEach((note, i) => {
        setTimeout(() => {
          spawnCircle(note, angle);
          if (i === notes.length - 1) seqActiveRef.current = false;
        }, i * stepMs);
      });
    }
  }, [spawnCircle]);

  // ---- Stop transport (recording) ----
  const stopTransport = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    Tone.getTransport().position = 0;
    isRecordingRef.current = false;
    clearInterval(beatIntervalRef.current);
    if (beatDisplayRef.current) beatDisplayRef.current.textContent = "—";
    setIsPlaying(false);
    if (recordingRef.current.length > 0) setHasMidi(true);
  }, []);

  // ---- Stop playback ----
  const stopPlayback = useCallback(() => {
    if (playbackPartRef.current) {
      clearTimeout(playbackPartRef.current);
      playbackPartRef.current = null;
    }
    synthRef.current?.releaseAll?.();
    isPlayingBackRef.current = false;
    setIsPlayingBack(false);
  }, []);

  // ---- Playback recorded events ----
  const handlePlayback = useCallback(async () => {
    const events = recordingRef.current;
    if (!events.length) return;
    if (!audioReadyRef.current) { await Tone.start(); audioReadyRef.current = true; }

    const eighthNote = 60 / bpmRef.current / 2;
    const startTime  = Tone.now() + 0.05;
    let   lastTime   = 0;

    events.forEach(ev => {
      let t = ev.time;
      if (quantizeRef.current) t = Math.round(t / eighthNote) * eighthNote;
      synthRef.current.triggerAttackRelease(ev.note, ev.duration, startTime + t, ev.velocity);
      if (t > lastTime) lastTime = t;
    });

    isPlayingBackRef.current = true;
    setIsPlayingBack(true);

    // Auto-stop after last note + release tail
    playbackPartRef.current = setTimeout(() => stopPlayback(), (lastTime + 2.5) * 1000);
  }, [stopPlayback]);

  // ---- startFromTrigger — called when ball hits trigger line ----
  const startFromTrigger = useCallback(() => {
    isArmedRef.current = false;
    setArmedMode(null);

    // How long did the ball take to travel from dispenser to trigger?
    const travelTimeSec = (Date.now() - armFireTimeRef.current) / 1000;
    const barSec        = (60 / bpmRef.current) * timeSigRef.current;
    // Fire each bar this many seconds early so the ball arrives on beat 1
    const fireOffsetSec = Math.max(0.05, barSec - travelTimeSec);

    const mode      = armModeRef.current;
    const transport = Tone.getTransport();
    transport.start();

    // Metronome
    let beatCount = 0;
    transport.scheduleRepeat((time) => {
      if (clickSynthRef.current) {
        const isDownbeat = (beatCount % timeSigRef.current) === 0;
        clickSynthRef.current.triggerAttackRelease(isDownbeat ? "C5" : "C4", "32n", time);
      }
      beatCount++;
    }, "4n");

    if (mode === "play") {
      // Schedule exactly barCount-1 fires (bar 1 is already live from arm)
      for (let i = 0; i < barCountRef.current - 1; i++) {
        const t = fireOffsetSec + i * barSec;
        transport.scheduleOnce((time) => {
          const msUntil = Math.max(0, (time - Tone.now()) * 1000);
          setTimeout(() => { fire(); cullOldBalls(); }, msUntil);
        }, t);
      }
      isRecordingRef.current = true;
      setIsPlaying(true);
      transport.scheduleOnce((time) => {
        const msUntil = Math.max(0, (time - Tone.now()) * 1000);
        setTimeout(() => stopTransport(), msUntil);
      }, `${barCountRef.current}m`);
    } else {
      // Loop: fire every bar, indefinitely
      transport.scheduleRepeat((time) => {
        const msUntil = Math.max(0, (time - Tone.now()) * 1000);
        setTimeout(() => { fire(); cullOldBalls(); }, msUntil);
      }, "1m", fireOffsetSec);
      isLoopingRef.current = true;
      setIsLooping(true);
    }

    beatIntervalRef.current = setInterval(() => {
      if (!beatDisplayRef.current) return;
      const pos  = transport.position.toString().split(":");
      const bar  = parseInt(pos[0]) + 1;
      const beat = parseInt(pos[1]) + 1;
      beatDisplayRef.current.textContent = `${bar}.${beat}`;
    }, 50);
  }, [fire, cullOldBalls, stopTransport]);

  // Keep ref current so the collision handler (inside useEffect) can call it
  startFromTriggerRef.current = startFromTrigger;

  // ---- Arm helpers ----
  const armTransport = useCallback(async (mode) => {
    if (!audioReadyRef.current) { await Tone.start(); audioReadyRef.current = true; }
    const transport = Tone.getTransport();
    transport.bpm.value = bpmRef.current;
    transport.timeSignature = timeSigRef.current;
    transport.cancel();
    transport.position = 0;
    recordingRef.current = [];
    setHasMidi(false);
    singleIdxRef.current = 0;
    handleClearBalls();
    armModeRef.current   = mode;
    isArmedRef.current   = true;
    armFireTimeRef.current = Date.now();
    setArmedMode(mode);
    fire();
  }, [fire]);

  const cancelArm = useCallback(() => {
    isArmedRef.current = false;
    armModeRef.current = null;
    setArmedMode(null);
  }, []);

  // ---- Play (arm → wait for trigger hit) ----
  const handlePlay = useCallback(async () => {
    await armTransport("play");
  }, [armTransport]);

  // ---- Loop (arm → wait for trigger hit, then loop forever) ----
  const handleLoopToggle = useCallback(async () => {
    if (isLoopingRef.current) {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      Tone.getTransport().position = 0;
      isLoopingRef.current = false;
      clearInterval(beatIntervalRef.current);
      if (beatDisplayRef.current) beatDisplayRef.current.textContent = "—";
      setIsLooping(false);
      return;
    }
    await armTransport("loop");
  }, [armTransport]);

  // ---- MIDI export ----
  const exportMidi = useCallback(() => {
    const events = recordingRef.current;
    if (!events.length) return;
    const bpm       = bpmRef.current;
    const eighthNote = 60 / bpm / 2;
    const midi      = new Midi();
    midi.header.setTempo(bpm);
    const track = midi.addTrack();

    events.forEach(ev => {
      let time = ev.time;
      if (quantizeRef.current) {
        time = Math.round(time / eighthNote) * eighthNote;
      }
      track.addNote({
        midi:     noteToMidi(ev.note),
        time,
        duration: ev.duration,
        velocity: ev.velocity,
      });
    });

    const blob = new Blob([midi.toArray()], { type: "audio/midi" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "play.mid"; a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ---- Synth swap ----
  const handleSynthChange = useCallback((name) => {
    const old  = synthRef.current;
    const next = SYNTH_PRESETS[name]().toDestination();
    next.volume.value = Tone.gainToDb(volumeRef.current);
    synthRef.current  = next;
    old?.dispose();
  }, []);

  // ---- Physics setup ----
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;

    const engine = Matter.Engine.create({ gravity: { y: 1 } });
    engineRef.current = engine;
    const runner = Matter.Runner.create();

    const T  = WALL;
    const wo = { isStatic: true, restitution: BOUNCE, friction: 0, frictionStatic: 0 };
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(W/2, -T/2,    W+T*2, T,   wo), // top
      Matter.Bodies.rectangle(-T/2, H/2,    T, H+T*2,   wo), // left
      Matter.Bodies.rectangle(W+T/2, H/2,   T, H+T*2,   wo), // right
      // no bottom wall — balls fall through and get deleted
    ]);

    // Delete balls that fall below canvas
    Matter.Events.on(engine, "afterUpdate", () => {
      const fallen = Matter.Composite.allBodies(engine.world)
        .filter(b => !b.isStatic && b.position.y > H + RADIUS * 2);
      if (fallen.length) Matter.Composite.remove(engine.world, fallen);
    });

    const dispenser = Matter.Bodies.rectangle(W/2, 80, D_W, D_H, {
      isStatic: true, label: "dispenser", restitution: 0.5, friction: 0,
      collisionFilter: { mask: 0 },
    });
    Matter.Composite.add(engine.world, dispenser);
    dispenserRef.current = dispenser;

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 2.0 },
    }).toDestination();
    synth.volume.value = Tone.gainToDb(volumeRef.current);
    synthRef.current = synth;

    // Click synth — short triangle burst, two pitches for downbeat vs beat
    const clickSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.04 },
    }).toDestination();
    clickSynth.volume.value = -8;
    clickSynthRef.current = clickSynth;

    Matter.Events.on(engine, "collisionStart", (event) => {
      if (!audioReadyRef.current || isPlayingBackRef.current) return;

      // Trigger line: first ball hit starts the transport
      if (isArmedRef.current) {
        for (const pair of event.pairs) {
          const { bodyA, bodyB } = pair;
          const hasTrigger = bodyA.label === "trigger" || bodyB.label === "trigger";
          const hasBall    = (!bodyA.isStatic && bodyA.label.match(/^[A-G]#?\d+$/)) ||
                             (!bodyB.isStatic && bodyB.label.match(/^[A-G]#?\d+$/));
          if (hasTrigger && hasBall) {
            startFromTriggerRef.current?.();
            break;
          }
        }
      }

      for (const pair of event.pairs) {
        const { bodyA, bodyB, collision } = pair;
        const speed = collision.depth + Math.hypot(
          bodyA.velocity.x - bodyB.velocity.x,
          bodyA.velocity.y - bodyB.velocity.y,
        );
        if (speed < MIN_VEL) continue;
        for (const body of [bodyA, bodyB]) {
          if (body.isStatic || !body.label.match(/^[A-G]#?\d+$/)) continue;
          const now = Date.now();
          if (now - (lastPlayedRef.current[body.id] || 0) < COOLDOWN) continue;
          lastPlayedRef.current[body.id] = now;
          const gain = velLinkedRef.current ? Math.min(speed / 12, 1.0) : 1.0;
          const s = synthRef.current;
          if (!s) continue;
          s.volume.value = Tone.gainToDb(gain * volumeRef.current);
          s.triggerAttackRelease(body.label, "8n", Tone.now());

          // Record if transport is running
          if (isRecordingRef.current) {
            recordingRef.current.push({
              note:     body.label,
              time:     Tone.getTransport().seconds,
              velocity: gain,
              duration: 60 / bpmRef.current / 2,
            });
          }
        }
      }
    });

    Matter.Composite.add(engine.world, Matter.MouseConstraint.create(engine, {
      mouse: Matter.Mouse.create(canvas),
      constraint: { stiffness: 0.2, render: { visible: false } },
    }));

    Matter.Runner.run(runner, engine);
    let rafId;
    const loop = () => { drawScene(); rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(loop);

    const onResize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(beatIntervalRef.current);
      Tone.getTransport().cancel();
      Tone.getTransport().stop();
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      synth.dispose();
      clickSynth.dispose();
      window.removeEventListener("resize", onResize);
    };
  }, [drawScene]);

  // ---- Space = fire (manual, when not playing) ----
  useEffect(() => {
    const onKey = async (e) => {
      if (e.code !== "Space" || e.target !== document.body) return;
      e.preventDefault();
      if (!audioReadyRef.current) { await Tone.start(); audioReadyRef.current = true; }
      fire();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  // ---- Line helpers ----
  const hitTestLine = (mx, my) => {
    for (const line of linesRef.current) {
      const { body } = line;
      const { x: cx, y: cy } = body.position;
      const ang = body.angle;
      const hw  = LINE_LENGTH / 2;

      // Rotate handle (right end)
      const rotX = cx + Math.cos(ang) * (hw + LINE_HANDLE_R + 2);
      const rotY = cy + Math.sin(ang) * (hw + LINE_HANDLE_R + 2);
      if (Math.hypot(mx - rotX, my - rotY) <= LINE_HANDLE_R + 4)
        return { line, part: "rotate" };

      // Delete handle (left end)
      const delX = cx - Math.cos(ang) * (hw + LINE_HANDLE_R + 2);
      const delY = cy - Math.sin(ang) * (hw + LINE_HANDLE_R + 2);
      if (Math.hypot(mx - delX, my - delY) <= LINE_HANDLE_R + 4)
        return { line, part: "delete" };

      // Line body — transform to local space
      const dx = mx - cx, dy = my - cy;
      const lx = dx * Math.cos(-ang) - dy * Math.sin(-ang);
      const ly = dx * Math.sin(-ang) + dy * Math.cos(-ang);
      if (Math.abs(lx) <= hw + 4 && Math.abs(ly) <= LINE_THICKNESS / 2 + 8)
        return { line, part: "body" };
    }
    return null;
  };

  const handleAddLine = () => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const cx = canvas.width  / 2 + (Math.random() - 0.5) * 120;
    const cy = canvas.height / 2 + (Math.random() - 0.5) * 80;
    const body = Matter.Bodies.rectangle(cx, cy, LINE_LENGTH, LINE_THICKNESS, {
      isStatic: true, label: "line",
      restitution: BOUNCE, friction: 0, frictionStatic: 0,
    });
    Matter.Composite.add(engine.world, body);
    linesRef.current = [...linesRef.current, { body }];
  };

  const handleAddTriggerLine = () => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    // Remove existing trigger line
    const existing = linesRef.current.find(l => l.isTrigger);
    if (existing) {
      Matter.Composite.remove(engine.world, existing.body);
      linesRef.current = linesRef.current.filter(l => l !== existing);
    }
    const cx = canvas.width  / 2 + (Math.random() - 0.5) * 120;
    const cy = canvas.height / 2 + (Math.random() - 0.5) * 80;
    const body = Matter.Bodies.rectangle(cx, cy, LINE_LENGTH, LINE_THICKNESS, {
      isStatic: true, label: "trigger",
      restitution: BOUNCE, friction: 0, frictionStatic: 0,
    });
    Matter.Composite.add(engine.world, body);
    linesRef.current = [...linesRef.current, { body, isTrigger: true }];
  };

  const handleDeleteLine = (line) => {
    const engine = engineRef.current;
    if (!engine) return;
    Matter.Composite.remove(engine.world, line.body);
    linesRef.current = linesRef.current.filter(l => l !== line);
    hoveredLineRef.current = null;
  };

  // ---- Dispenser drag ----
  const isOnDispenser = (x, y) => {
    const d = dispenserRef.current;
    if (!d) return false;
    const p = d.position, pad = 14;
    return x >= p.x - D_W/2 - pad && x <= p.x + D_W/2 + pad &&
           y >= p.y - D_H/2 - pad && y <= p.y + D_H/2 + D_NOZZLE + pad;
  };

  const handleMouseDown = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;

    // Line interactions take priority
    const hit = hitTestLine(x, y);
    if (hit) {
      if (hit.part === "delete") {
        handleDeleteLine(hit.line);
        return;
      }
      lineInteractRef.current = {
        mode: hit.part === "rotate" ? "rotate" : "drag",
        line: hit.line,
        ox: x - hit.line.body.position.x,
        oy: y - hit.line.body.position.y,
      };
      return;
    }

    if (isOnDispenser(x, y)) {
      const p = dispenserRef.current.position;
      dragRef.current = { active: true, ox: x - p.x, oy: y - p.y, moved: false };
    }
  };

  const handleMouseMove = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;

    // Line interaction in progress
    const li = lineInteractRef.current;
    if (li.mode === "drag") {
      Matter.Body.setPosition(li.line.body, { x: x - li.ox, y: y - li.oy });
      dragRef.current.moved = true;
      canvasRef.current.style.cursor = "grabbing";
      return;
    }
    if (li.mode === "rotate") {
      const { x: cx, y: cy } = li.line.body.position;
      const ang = Math.atan2(y - cy, x - cx);
      Matter.Body.setAngle(li.line.body, ang);
      dragRef.current.moved = true;
      canvasRef.current.style.cursor = "crosshair";
      return;
    }

    // Hover detection
    const hit = hitTestLine(x, y);
    hoveredLineRef.current = hit || null;

    if (dragRef.current.active) {
      canvasRef.current.style.cursor = "grabbing";
    } else if (hit) {
      canvasRef.current.style.cursor = hit.part === "rotate" ? "crosshair" : hit.part === "delete" ? "pointer" : "grab";
    } else {
      canvasRef.current.style.cursor = isOnDispenser(x, y) ? "grab" : "crosshair";
    }

    if (!dragRef.current.active) return;
    dragRef.current.moved = true;
    Matter.Body.setPosition(dispenserRef.current, {
      x: x - dragRef.current.ox,
      y: y - dragRef.current.oy,
    });
  };

  const handleMouseUp = () => {
    lineInteractRef.current = { mode: null, line: null, ox: 0, oy: 0 };
    dragRef.current.active = false;
    canvasRef.current.style.cursor = "crosshair";
  };

  const handleCanvasClick = async (e) => {
    if (dragRef.current.moved) { dragRef.current.moved = false; return; }
    if (!audioReadyRef.current) { await Tone.start(); audioReadyRef.current = true; }
    const r = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (isOnDispenser(x, y)) return;
    const notes = buildNotes(rootKeyRef.current, presetRef.current);
    const note  = notes[singleIdxRef.current % notes.length];
    singleIdxRef.current++;
    const body = Matter.Bodies.circle(x, y, RADIUS, {
      restitution: BOUNCE, friction: 0.01, frictionAir: 0.005, label: note,
    });
    body.spawnedAt = Date.now();
    Matter.Composite.add(engineRef.current.world, body);
  };

  // ---- UI handlers ----
  const handleFire = async () => {
    if (!audioReadyRef.current) { await Tone.start(); audioReadyRef.current = true; }
    fire();
  };

  const handleClearBalls = () => {
    const engine = engineRef.current;
    if (!engine) return;
    Matter.Composite.remove(engine.world,
      Matter.Composite.allBodies(engine.world).filter(b => !b.isStatic));
    singleIdxRef.current = 0;
  };

  const handleGravity = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const modes  = ["normal", "zero", "inverted"];
    const labels = { normal: "gravity ↓", zero: "gravity ○", inverted: "gravity ↑" };
    const next   = modes[(modes.indexOf(gravityModeRef.current) + 1) % 3];
    gravityModeRef.current = next;
    engine.gravity.y = next === "normal" ? 1 : next === "inverted" ? -1 : 0;
    if (gravityBtnRef.current) gravityBtnRef.current.textContent = labels[next];
  };

  const handleAngle = (e) => {
    const deg = parseFloat(e.target.value);
    dispenserAngleRef.current = (deg * Math.PI) / 180;
    Matter.Body.setAngle(dispenserRef.current, -dispenserAngleRef.current);
    if (angleLabelRef.current) angleLabelRef.current.textContent = `${deg}°`;
  };

  return (
    <div className="play-page">
      <div className="play-ui">

        {/* Transport */}
        <div className="play-ui-group">
          <label>BPM <input type="number" min="40" max="240" defaultValue="120" style={{width:50}}
            onChange={e => bpmRef.current = parseInt(e.target.value) || 120} /></label>
          <select defaultValue="4" onChange={e => timeSigRef.current = parseInt(e.target.value)}>
            <option value="4">4/4</option>
            <option value="3">3/4</option>
            <option value="6">6/8</option>
          </select>
          <select defaultValue="4" onChange={e => barCountRef.current = parseInt(e.target.value)}>
            {[2,4,8,16].map(n => <option key={n} value={n}>{n} bars</option>)}
          </select>
        </div>

        <div className="play-ui-sep" />

        {/* Play / Stop + loop + beat display */}
        <div className="play-ui-group">
          {isPlaying
            ? <button onClick={stopTransport}>■ stop</button>
            : armedMode === "play"
              ? <button onClick={cancelArm}>● armed</button>
              : <button disabled={!!isLooping || !!armedMode} onClick={handlePlay}><strong>▶ play</strong></button>
          }
          {isLooping
            ? <button onClick={handleLoopToggle}>■ loop</button>
            : armedMode === "loop"
              ? <button onClick={cancelArm}>● armed</button>
              : <button disabled={!!isPlaying || !!armedMode} onClick={handleLoopToggle}>↺ loop</button>
          }
          <span ref={beatDisplayRef} className="play-beat">—</span>
        </div>

        <div className="play-ui-sep" />

        {/* Sound */}
        <div className="play-ui-group">
          <select defaultValue="D" onChange={e => { rootKeyRef.current = e.target.value; singleIdxRef.current = 0; }}>
            {KEYS.map(k => <option key={k}>{k}</option>)}
          </select>
          <select defaultValue="Maj 7" onChange={e => { presetRef.current = e.target.value; singleIdxRef.current = 0; }}>
            {Object.keys(PRESETS).map(p => <option key={p}>{p}</option>)}
          </select>
          <select defaultValue="Triangle" onChange={e => handleSynthChange(e.target.value)}>
            {Object.keys(SYNTH_PRESETS).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="play-ui-sep" />

        {/* Fire mode */}
        <div className="play-ui-group">
          {[["single","Single"],["burst","Burst"],["seq","Seq"]].map(([val, label]) => (
            <label key={val}>
              <input type="radio" name="mode" value={val} defaultChecked={val === "seq"}
                onChange={() => fireModeRef.current = val} />
              {" "}{label}
            </label>
          ))}
          <label>step{" "}
            <select defaultValue="1/8" onChange={e => {
              seqDivRef.current = e.target.value;
              setSeqFree(e.target.value === "free");
            }}>
              {["1/4","1/8","1/16","1/32","free"].map(d => <option key={d}>{d}</option>)}
            </select>
          </label>
          {seqFree && (
            <label>{seqDelayRef.current}ms
              <input type="range" min="20" max="600" step="10" defaultValue="180"
                onChange={e => seqDelayRef.current = parseInt(e.target.value)} />
            </label>
          )}
        </div>

        <div className="play-ui-sep" />

        <button className="play-fire-btn" onClick={handleFire}>FIRE</button>

        <div className="play-ui-sep" />

        {/* Dispenser + global */}
        <div className="play-ui-group">
          <label>
            angle <input type="range" min="0" max="360" step="1" defaultValue="0" onChange={handleAngle} />
            {" "}<span ref={angleLabelRef}>0°</span>
          </label>
          <label>vol <input type="range" min="0" max="1" step="0.01" defaultValue="0.7"
            onChange={e => volumeRef.current = parseFloat(e.target.value)} /></label>
          <label><input type="checkbox" onChange={e => velLinkedRef.current = e.target.checked} /> vel→vol</label>
          <button ref={gravityBtnRef} onClick={handleGravity}>gravity ↓</button>
          <button onClick={handleAddLine}>+ line</button>
          <button onClick={handleAddTriggerLine} style={{color:"#e8890c"}}>+ trigger</button>
          <button onClick={handleClearBalls}>clear</button>
        </div>

        <div className="play-ui-sep" />

        {/* Export / Playback */}
        <div className="play-ui-group">
          <label><input type="checkbox" onChange={e => quantizeRef.current = e.target.checked} /> quantize 8ths</label>
          {isPlayingBack
            ? <button onClick={stopPlayback}>■ stop playback</button>
            : <button disabled={!hasMidi || isPlaying} onClick={handlePlayback}>▶ playback</button>
          }
          <button disabled={!hasMidi} onClick={exportMidi}>⬇ MIDI</button>
        </div>

      </div>

      <canvas
        ref={canvasRef}
        className="play-canvas"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
