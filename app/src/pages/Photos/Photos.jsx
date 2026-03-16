import React, { useState, useEffect, useRef, useCallback } from 'react'
import './Photos.css'
import truckRaw from '../../assets/proud_true_toyota.svg?raw'
import wheelSvg from '../../assets/better_wheels.svg'

const API_BASE = 'https://api.charliedahle.me'

// ── Truck color variants ───────────────────────────────────────────────────────
// Blue weighted 2x so it appears most often, with red and yellow mixed in
const TRUCK_COLORS = ['#2ba9f5', '#e63946', '#f7c948', '#e8e0d0', '#2d6a1f']

function makeTruckSrc(bodyColor) {
  const svg = truckRaw.replace('fill: #2ba9f5', `fill: ${bodyColor}`)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ── Grass decorations (generated once at module load) ─────────────────────────
const FLOWER_COLORS = ['#FFE135', '#FFB7C5', '#ffffff', '#FF8FAB', '#FFD580']

function randomDecorations() {
  const items = []
  // Two grass zones: above top road and between the two roads
  const zones = [
    { yMin: 2,  yMax: 26 },
    { yMin: 52, yMax: 72 },
  ]
  let id = 0
  for (const zone of zones) {
    for (let i = 0; i < 28; i++) {
      items.push({
        id: id++,
        x: 1 + Math.random() * 98,
        y: zone.yMin + Math.random() * (zone.yMax - zone.yMin),
        type: Math.random() < 0.55 ? 'flower' : 'plant',
        color: FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)],
        scale: 0.6 + Math.random() * 0.8,
        tilt: (Math.random() - 0.5) * 20,
      })
    }
  }
  return items
}

const DECORATIONS = randomDecorations()

let nextId = 0
let photoIndex = 0

// ── Truck geometry ────────────────────────────────────────────────────────────
const TRUCK_ASPECT = 544.1 / 219.57
const TRUCK_HEIGHT = 140
const TRUCK_WIDTH  = Math.round(TRUCK_HEIGHT * TRUCK_ASPECT)
const SVG_SCALE    = TRUCK_HEIGHT / 219.57

// ── Wheel geometry (derived from SVG: well top y=151.77, ground y=219.57) ────
const WHEEL_DIAMETER    = Math.round(67.8 * SVG_SCALE) + 6
const WHEEL_RADIUS      = WHEEL_DIAMETER / 2
const FRONT_WHEEL_LEFT  = Math.round(75  * SVG_SCALE - WHEEL_RADIUS)
const REAR_WHEEL_LEFT   = Math.round(409 * SVG_SCALE - WHEEL_RADIUS)
const WHEEL_TOP         = Math.round(185.77 * SVG_SCALE - WHEEL_RADIUS) + 7

// ── Photo geometry (centered on stilt area x=314–476, y=0.5–115) ─────────────
const STILT_CENTER_X = (314.56 + 476.17) / 2 * SVG_SCALE
const STILT_CENTER_Y = (0.5   + 115.09) / 2 * SVG_SCALE
const PHOTO_WIDTH    = Math.round((476.17 - 314.56) * SVG_SCALE * 3.0)
const PHOTO_HEIGHT   = Math.round((115.09 - 0.5)   * SVG_SCALE * 3.0)
const PHOTO_LEFT        = Math.round(STILT_CENTER_X - PHOTO_WIDTH  / 2)
const PHOTO_TOP         = Math.round(STILT_CENTER_Y - PHOTO_HEIGHT / 2) - 120
// Y transform for the separate photo container (same lane top anchor as truck)
const PHOTO_TRANSLATE_Y = -TRUCK_HEIGHT / 2 + PHOTO_TOP

// Photo X relative to car.x — lane-1 is mirrored so we flip the offset
const getPhotoX = (car) =>
  car.lane === 1
    ? car.x + TRUCK_WIDTH - PHOTO_LEFT - PHOTO_WIDTH
    : car.x + PHOTO_LEFT

// ── Physics constants ─────────────────────────────────────────────────────────
const SAFE_GAP    = 24
const GAP_BUFFER  = 80
const ACCEL       = 120
const DECEL       = 480
const SPAWN_CLEAR = 220

// ─────────────────────────────────────────────────────────────────────────────

function Photos() {
  const [photos, setPhotos] = useState([])
  const [carList, setCarList] = useState([])
  const [uploadStatus, setUploadStatus] = useState('idle') // idle | uploading | success | error
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  const fetchPhotos = useCallback(() => {
    fetch(`${API_BASE}/api/photos`)
      .then(r => r.json())
      .then(data => setPhotos(data.photos || []))
      .catch(err => console.error('Failed to load photos:', err))
  }, [])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // ── Webcam state (desktop only) ─────────────────────────────────────────────
  const [showWebcam, setShowWebcam] = useState(false)
  const videoRef  = useRef(null)
  const streamRef = useRef(null)

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setShowWebcam(false)
  }, [])

  // ── Core upload logic ───────────────────────────────────────────────────────
  const uploadFile = useCallback(async (file) => {
    setUploadStatus('uploading')
    try {
      const presignRes = await fetch(`${API_BASE}/api/photos/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, fileSize: file.size }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json()
        throw new Error(err.error || 'Upload failed')
      }
      const { uploadUrl, r2Key } = await presignRes.json()
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      await fetch(`${API_BASE}/api/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key, filename: file.name, mimeType: file.type }),
      })
      fetchPhotos()
      setUploadStatus('success')
      setTimeout(() => setUploadStatus('idle'), 2500)
    } catch (err) {
      setUploadError(err.message)
      setUploadStatus('error')
      setTimeout(() => setUploadStatus('idle'), 3000)
    }
  }, [fetchPhotos])

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      setShowWebcam(true)
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 0)
    } catch {
      fileInputRef.current?.click()
    }
  }, [])

  const captureWebcam = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(async (blob) => {
      stopWebcam()
      const file = new File([blob], 'webcam-photo.jpg', { type: 'image/jpeg' })
      await uploadFile(file)
    }, 'image/jpeg', 0.92)
  }, [stopWebcam, uploadFile])

  // ── Mobile: file input handler ──────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image must be under 10MB')
      setUploadStatus('error')
      setTimeout(() => setUploadStatus('idle'), 3000)
      return
    }
    await uploadFile(file)
  }, [uploadFile])


  // ── Sign click: route to webcam or camera roll ──────────────────────────────
  const handleSignClick = useCallback(() => {
    if (uploadStatus !== 'idle') return
    if (isMobile) {
      fileInputRef.current?.click()
    } else {
      startWebcam()
    }
  }, [uploadStatus, isMobile, startWebcam])

  // Physics state (mutated directly in animation loop)
  const carsRef = useRef([])

  // DOM refs for direct manipulation
  const containerRefs      = useRef({})
  const photoContainerRefs = useRef({})
  const wheelFrontRefs     = useRef({})
  const wheelRearRefs      = useRef({})

  const rafRef      = useRef(null)
  const lastTimeRef = useRef(null)

  // Per-lane spawn timers
  const spawnTimerRef1 = useRef(null)
  const spawnTimerRef2 = useRef(null)

  // ── Physics + render loop ───────────────────────────────────────────────────
  useEffect(() => {
    const tick = (timestamp) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = timestamp

      const vw = window.innerWidth
      const toRemove = []

      for (const laneNum of [1, 2]) {
        const lane = carsRef.current.filter(c => c.lane === laneNum)
        lane.sort(laneNum === 1 ? (a, b) => b.x - a.x : (a, b) => a.x - b.x)

        for (let i = 0; i < lane.length; i++) {
          const car    = lane[i]
          const leader = i > 0 ? lane[i - 1] : null

          // Stopped cars always target zero — cars behind queue up via following logic
          let targetSpeed = car.stopped ? 0 : car.maxSpeed

          if (!car.stopped && leader) {
            const gap = laneNum === 1
              ? leader.x - (car.x + car.width)
              : car.x   - (leader.x + leader.width)

            if (gap <= 0) {
              targetSpeed = 0
            } else if (gap < SAFE_GAP) {
              targetSpeed = leader.currentSpeed * (gap / SAFE_GAP)
            } else if (gap < SAFE_GAP + GAP_BUFFER) {
              targetSpeed = Math.min(car.maxSpeed, leader.currentSpeed)
            }
          }

          // Smooth speed transition
          if (car.currentSpeed > targetSpeed) {
            car.currentSpeed = Math.max(0, car.currentSpeed - DECEL * dt)
            if (car.currentSpeed < targetSpeed) car.currentSpeed = targetSpeed
          } else {
            car.currentSpeed = Math.min(car.maxSpeed, car.currentSpeed + ACCEL * dt)
            if (car.currentSpeed > targetSpeed) car.currentSpeed = targetSpeed
          }

          if (laneNum === 1) car.x += car.currentSpeed * dt
          else               car.x -= car.currentSpeed * dt

          // Wheel rotation (negative = counterclockwise, correct for both lanes)
          car.wheelRotation -= (car.currentSpeed / WHEEL_RADIUS) * dt * (180 / Math.PI) * 0.4

          // Push position to DOM
          const containerEl = containerRefs.current[car.id]
          if (containerEl) {
            const flip = laneNum === 1 ? ' scaleX(-1)' : ''
            containerEl.style.transform = `translateX(${car.x}px) translateY(-50%)${flip}`
          }
          const photoEl = photoContainerRefs.current[car.id]
          if (photoEl) {
            photoEl.style.transform = `translateX(${getPhotoX(car)}px) translateY(${PHOTO_TRANSLATE_Y}px)`
          }
          const frontEl = wheelFrontRefs.current[car.id]
          const rearEl  = wheelRearRefs.current[car.id]
          if (frontEl) frontEl.style.transform = `rotate(${car.wheelRotation}deg)`
          if (rearEl)  rearEl.style.transform  = `rotate(${car.wheelRotation}deg)`

          if (laneNum === 1 && car.x > vw + car.width + 50) toRemove.push(car.id)
          if (laneNum === 2 && car.x < -car.width - 50)     toRemove.push(car.id)
        }
      }

      if (toRemove.length > 0) {
        carsRef.current = carsRef.current.filter(c => !toRemove.includes(c.id))
        toRemove.forEach(id => {
          delete containerRefs.current[id]
          delete photoContainerRefs.current[id]
          delete wheelFrontRefs.current[id]
          delete wheelRearRefs.current[id]
        })
        setCarList(prev => prev.filter(c => !toRemove.includes(c.id)))
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Spawning ────────────────────────────────────────────────────────────────
  const spawnCar = useCallback((lane) => {
    const vw = window.innerWidth
    const laneCars = carsRef.current.filter(c => c.lane === lane)

    if (lane === 1 && laneCars.some(c => c.x < SPAWN_CLEAR)) return
    if (lane === 2 && laneCars.some(c => c.x > vw - SPAWN_CLEAR)) return
    if (photos.length === 0) return

    const id        = nextId++
    const photo     = photos[photoIndex++ % photos.length].url
    const bodyColor = TRUCK_COLORS[Math.floor(Math.random() * TRUCK_COLORS.length)]
    const truckSrc  = makeTruckSrc(bodyColor)
    const maxSpeed  = 160 + Math.random() * 150
    const startX    = lane === 1 ? -(TRUCK_WIDTH + 10) : vw + 10

    carsRef.current.push({
      id, lane, width: TRUCK_WIDTH, height: TRUCK_HEIGHT,
      maxSpeed, currentSpeed: maxSpeed, x: startX, wheelRotation: 0, stopped: false,
    })
    const initialPhotoX = lane === 1
      ? startX + TRUCK_WIDTH - PHOTO_LEFT - PHOTO_WIDTH
      : startX + PHOTO_LEFT

    setCarList(prev => [...prev, { id, lane, initialX: startX, initialPhotoX, photo, truckSrc, stopped: false }])
  }, [photos])

  useEffect(() => {
    if (photos.length === 0) return

    const makeScheduler = (laneNum, timerRef) => {
      const scheduleNext = () => {
        const delay = 2000 + Math.random() * 4000
        timerRef.current = setTimeout(() => {
          // Don't spawn while any car in this lane is stopped — timer keeps ticking
          const laneHasStopped = carsRef.current.some(c => c.lane === laneNum && c.stopped)
          if (!laneHasStopped) spawnCar(laneNum)
          scheduleNext()
        }, delay)
      }
      spawnCar(laneNum)
      scheduleNext()
    }

    makeScheduler(1, spawnTimerRef1)
    makeScheduler(2, spawnTimerRef2)

    return () => {
      clearTimeout(spawnTimerRef1.current)
      clearTimeout(spawnTimerRef2.current)
    }
  }, [spawnCar, photos])

  // ── Click to stop / resume ──────────────────────────────────────────────────
  const handleTruckClick = useCallback((id) => {
    const car = carsRef.current.find(c => c.id === id)
    if (!car) return
    car.stopped = !car.stopped
    setCarList(prev => prev.map(c => c.id === id ? { ...c, stopped: car.stopped } : c))
  }, [])

  // ── Lightbox ─────────────────────────────────────────────────────────────────
  const [expandedPhoto, setExpandedPhoto] = useState(null)

  const handlePhotoClick = useCallback((e, car) => {
    if (!car.stopped) return
    e.stopPropagation()
    setExpandedPhoto(car.photo)
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="photos-root">
      <header className="photos-header">
        <a href="https://charliedahle.me" className="photos-header-back">← charliedahle.me</a>
        <button
          className="photos-header-camera"
          onClick={handleSignClick}
          disabled={uploadStatus === 'uploading'}
          aria-label="Upload photo"
        >
          <svg className="camera-icon" viewBox="0 0 20 17" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 1.5L5.5 4H2C1.4 4 1 4.4 1 5V15C1 15.6 1.4 16 2 16H18C18.6 16 19 15.6 19 15V5C19 4.4 18.6 4 18 4H14.5L13 1.5H7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
      </header>
      {uploadStatus === 'success' && <div className="upload-toast">Photo uploaded!</div>}
      {uploadStatus === 'error'   && <div className="upload-toast upload-toast--error">{uploadError || 'Upload failed'}</div>}
    <div className="photos-page">
      {DECORATIONS.map(d => (
        <div
          key={d.id}
          className={`decor-${d.type}`}
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            '--petal': d.color,
            transform: `scale(${d.scale}) rotate(${d.tilt}deg)`,
          }}
        />
      ))}
      <div className="road road-lane-1">
        <div className="road-far-edge" />
        <div className="road-surface" />
        <div className="road-near-edge" />
      </div>
      <div className="road road-lane-2">
        <div className="road-far-edge" />
        <div className="road-surface" />
        <div className="road-near-edge" />
      </div>
      {carList.map(car => {
        const flip = car.lane === 1 ? ' scaleX(-1)' : ''
        return (
          <React.Fragment key={car.id}>
            {/* Truck body — gets flip for lane-1, sits behind flowers */}
            <div
              ref={el => { if (el) containerRefs.current[car.id] = el }}
              className={`truck-container lane-${car.lane}${car.stopped ? ' stopped' : ''}`}
              style={{
                width: TRUCK_WIDTH,
                height: TRUCK_HEIGHT,
                transform: `translateX(${car.initialX}px) translateY(-50%)${flip}`,
              }}
              onClick={() => handleTruckClick(car.id)}
            >
              <div className="truck-shadow" />
              <img src={car.truckSrc} className="truck-img" />
              <img
                ref={el => { if (el) wheelFrontRefs.current[car.id] = el }}
                src={wheelSvg}
                className="wheel"
                style={{ width: WHEEL_DIAMETER, height: WHEEL_DIAMETER, left: FRONT_WHEEL_LEFT, top: WHEEL_TOP }}
              />
              <img
                ref={el => { if (el) wheelRearRefs.current[car.id] = el }}
                src={wheelSvg}
                className="wheel"
                style={{ width: WHEEL_DIAMETER, height: WHEEL_DIAMETER, left: REAR_WHEEL_LEFT, top: WHEEL_TOP }}
              />
            </div>

            {/* Photo — separate element, always unflipped, sits above flowers */}
            <div
              ref={el => { if (el) photoContainerRefs.current[car.id] = el }}
              className={`truck-photo-outer lane-${car.lane}`}
              style={{ transform: `translateX(${car.initialPhotoX}px) translateY(${PHOTO_TRANSLATE_Y}px)` }}
              onClick={() => handleTruckClick(car.id)}
            >
              <div
                className="photo-wrapper"
                style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
                onClick={(e) => handlePhotoClick(e, car)}
              >
                <img src={car.photo} className="truck-photo" />
                {car.stopped && <div className="photo-expand-hint">click to expand</div>}
              </div>
            </div>
          </React.Fragment>
        )
      })}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {showWebcam && (
        <div className="webcam-modal" onClick={captureWebcam}>
          <video ref={videoRef} className="webcam-video" autoPlay playsInline />
          <div className="webcam-hint">click to capture</div>
        </div>
      )}

      {expandedPhoto && (
        <div className="lightbox" onClick={() => setExpandedPhoto(null)}>
          <img src={expandedPhoto} className="lightbox-photo" />
        </div>
      )}
    </div>
    </div>
  )
}

export default Photos
