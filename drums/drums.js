document.addEventListener('DOMContentLoaded', () => {
  // Audio Context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Constants
  const STEPS = 32; // 16th notes for two measures
  const MINUTE = 60000;
  const MAX_TRACKS = 10;
  
  // State
  let bpm = 120;
  let isPlaying = false;
  let currentStep = 0;
  let intervalId = null;
  let soundManifest = null;
  
  // DOM Elements
  const trackList = document.getElementById('track-list');
  const addTrackButton = document.getElementById('add-track-button');
  const playPauseButton = document.getElementById('play-pause');
  const bpmSlider = document.getElementById('bpm-slider');
  const bpmValue = document.getElementById('bpm-value');
  const clearButton = document.getElementById('clear-button');
  
  // Track Class
  class Track {
    constructor(id) {
      this.id = id;
      this.category = null;
      this.sound = null;
      this.buffer = null;
      this.volume = 1;
      this.isMuted = false;
      this.pattern = new Array(STEPS).fill(false);
    }
    
    // Load sound for this track
    async loadSound() {
      if (!this.sound) return null;
      
      try {
        const response = await fetch(this.sound.file);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          this.buffer = await audioContext.decodeAudioData(arrayBuffer);
          return this.buffer;
        } else {
          console.error(`Failed to load sound for track ${this.id}`);
          return null;
        }
      } catch (error) {
        console.error(`Error loading sound for track ${this.id}:`, error);
        return null;
      }
    }
    
    // Play sound for this track
    play() {
      if (!this.buffer || this.isMuted) return;
      
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      
      source.buffer = this.buffer;
      gainNode.gain.value = this.volume;
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      source.start(0);
    }
  }
  
  // Tracks management
  const tracks = [];
  
  // Fetch sound manifest
  async function fetchSoundManifest() {
    try {
      const response = await fetch('drum-sounds.json');
      soundManifest = response.ok ? await response.json() : null;
      
      if (!soundManifest) {
        throw new Error('Failed to load sound manifest');
      }
      
      return soundManifest;
    } catch (error) {
      console.error('Error loading sound manifest:', error);
      alert('Could not load sound library.');
      return null;
    }
  }
  
  // Update sound indicator
  function updateSoundIndicator(trackElement, category, soundName) {
    const soundIndicator = trackElement.querySelector('.track-sound');
    soundIndicator.textContent = soundName || 'No Sound Selected';
  }
  
  // Create track settings modal
  function createTrackSettingsModal(track, trackElement) {
    const modalTemplate = document.getElementById('track-settings-template');
    const modal = modalTemplate.content.cloneNode(true).querySelector('.modal-overlay');
    const modalBody = modal.querySelector('.track-settings-modal');
    
    // Close button functionality
    const closeButton = modalBody.querySelector('.btn-close-settings');
    closeButton.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    // Category dropdown
    const categoryDropdown = modalBody.querySelector('.category-dropdown');
    const categoryTrigger = modalBody.querySelector('.sound-category-selector .dropdown-trigger');
    
    // Populate categories
    Object.keys(soundManifest).forEach(category => {
      const categoryItem = document.createElement('div');
      categoryItem.className = 'dropdown-menu-item';
      categoryItem.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      categoryItem.addEventListener('click', () => {
        // Update track category
        track.category = category;
        
        // Update category display
        categoryTrigger.querySelector('.selected-category').textContent = categoryItem.textContent;
        
        // Populate sound dropdown
        populateSoundDropdown(track, modalBody, trackElement, category);
        
        // Close category dropdown
        categoryDropdown.classList.remove('active');
      });
      
      categoryDropdown.appendChild(categoryItem);
    });
    
    // Category dropdown toggle
    categoryTrigger.addEventListener('click', () => {
      categoryDropdown.classList.toggle('active');
    });
    
    // Volume slider
    const volumeSlider = modalBody.querySelector('.volume-slider');
    volumeSlider.value = track.volume * 100;
    volumeSlider.addEventListener('input', (e) => {
      track.volume = e.target.value / 100;
    });
    
    // Mute button
    const muteButton = modalBody.querySelector('.btn-mute');
    muteButton.addEventListener('click', () => {
      track.isMuted = !track.isMuted;
      if (track.isMuted) {
        muteButton.querySelector('i').classList.remove('fa-volume-up');
        muteButton.querySelector('i').classList.add('fa-volume-mute');
        muteButton.classList.add('btn-danger');
        muteButton.classList.remove('btn-secondary');
      } else {
        muteButton.querySelector('i').classList.add('fa-volume-up');
        muteButton.querySelector('i').classList.remove('fa-volume-mute');
        muteButton.classList.remove('btn-danger');
        muteButton.classList.add('btn-secondary');
      }
    });
    
    // Add modal to body
    document.body.appendChild(modal);
    modal.classList.add('active');
    
    return modal;
  }
  
  // Populate sound dropdown
  function populateSoundDropdown(track, modal, trackElement, category) {
    const soundDropdown = modal.querySelector('.sound-dropdown');
    const soundTrigger = modal.querySelector('.sound-selector .dropdown-trigger');
    
    // Clear existing sounds
    soundDropdown.innerHTML = '';
    
    // Populate sounds for selected category
    soundManifest[category].forEach(sound => {
      const soundItem = document.createElement('div');
      soundItem.className = 'dropdown-menu-item';
      soundItem.textContent = sound.name;
      soundItem.addEventListener('click', async () => {
        // Update track sound
        track.sound = sound;
        
        // Update sound display
        soundTrigger.querySelector('.selected-sound').textContent = sound.name;
        
        // Update sound indicator
        updateSoundIndicator(trackElement, category, sound.name);
        
        // Load sound
        await track.loadSound();
        
        // Close sound dropdown
        soundDropdown.classList.remove('active');
      });
      
      soundDropdown.appendChild(soundItem);
    });
    
    // Sound dropdown toggle
    soundTrigger.addEventListener('click', () => {
      soundDropdown.classList.toggle('active');
    });
  }
  
  // Create a new track
  function createTrack() {
    // Check max tracks limit
    if (tracks.length >= MAX_TRACKS) {
      alert(`Maximum of ${MAX_TRACKS} tracks reached.`);
      return;
    }
    
    // Create track instance
    const trackId = tracks.length + 1;
    const newTrack = new Track(trackId);
    tracks.push(newTrack);
    
    // Clone track template
    const trackTemplate = document.getElementById('track-template');
    const trackElement = trackTemplate.content.cloneNode(true).querySelector('.track');
    trackElement.dataset.trackId = trackId;
    trackElement.dataset.trackColor = trackId % 10 + 1;
    
    // Update track name
    const trackNameEl = trackElement.querySelector('.track-name');
    trackNameEl.textContent = `Track ${trackId}`;
    
    // Setup step sequencer
    const trackSteps = trackElement.querySelector('.track-steps');
    for (let i = 0; i < STEPS; i++) {
      const step = document.createElement('button');
      step.className = 'step';
      step.dataset.step = i;
      
      // Mark whole notes (every 4th step)
      if (i % 4 === 0) {
        step.classList.add('whole-note');
      }
      
      step.addEventListener('click', () => {
        newTrack.pattern[i] = !newTrack.pattern[i];
        step.classList.toggle('active', newTrack.pattern[i]);
      });
      
      trackSteps.appendChild(step);
    }
    
    // Track settings button
    const settingsButton = trackElement.querySelector('.btn-track-settings');
    settingsButton.addEventListener('click', () => {
      createTrackSettingsModal(newTrack, trackElement);
    });
    
    // Add track to DOM
    trackList.appendChild(trackElement);
    
    return newTrack;
  }
  
  // Sequencer step function
  function step() {
    // Update visual step indicator
    document.querySelectorAll('.step.current').forEach(step => {
      step.classList.remove('current');
    });
    
    const currentSteps = document.querySelectorAll(`.step[data-step="${currentStep}"]`);
    currentSteps.forEach(step => {
      step.classList.add('current');
    });
    
    // Play active sounds
    tracks.forEach(track => {
      if (track.pattern[currentStep] && track.buffer) {
        track.play();
      }
    });
    
    // Move to next step
    currentStep = (currentStep + 1) % STEPS;
  }
  
  // Playback controls
  function startPlayback() {
    if (isPlaying) return;
    
    isPlaying = true;
    playPauseButton.querySelector('i').classList.remove('fa-play');
    playPauseButton.querySelector('i').classList.add('fa-pause');
    playPauseButton.querySelector('span').textContent = 'Pause';
    
    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    // Initial step
    step();
    
    // Set interval based on current BPM
    const sixteenthNoteDuration = (MINUTE / bpm) / 4;
    intervalId = setInterval(step, sixteenthNoteDuration);
  }
  
  function stopPlayback() {
    if (!isPlaying) return;
    
    isPlaying = false;
    clearInterval(intervalId);
    
    // Reset play/pause button
    playPauseButton.querySelector('i').classList.remove('fa-pause');
    playPauseButton.querySelector('i').classList.add('fa-play');
    playPauseButton.querySelector('span').textContent = 'Play';
    
    // Clear current step indicators
    document.querySelectorAll('.step.current').forEach(step => {
      step.classList.remove('current');
    });
    
    // Reset current step
    currentStep = 0;
  }
  
  // Event Listeners
  function setupEventListeners() {
    // Transport controls
    playPauseButton.addEventListener('click', () => {
      isPlaying ? stopPlayback() : startPlayback();
    });
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      // Space bar to play/pause
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        isPlaying ? stopPlayback() : startPlayback();
      }
    });
    
    // BPM controls
    bpmSlider.addEventListener('input', (e) => {
      bpm = parseInt(e.target.value);
      bpmValue.textContent = bpm;
      
      // Restart playback with new tempo if already playing
      if (isPlaying) {
        stopPlayback();
        startPlayback();
      }
    });
    
    // Add track button
    addTrackButton.addEventListener('click', createTrack);
    
    // Clear all tracks
    clearButton.addEventListener('click', () => {
      tracks.forEach(track => {
        track.pattern.fill(false);
        const trackElement = document.querySelector(`.track[data-track-id="${track.id}"]`);
        trackElement.querySelectorAll('.step').forEach(step => {
          step.classList.remove('active');
        });
      });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.classList.remove('active');
        });
      }
    });
  }
  
  // Initialize application
  async function initialize() {
    // Fetch sound manifest
    await fetchSoundManifest();
    
    // Setup event listeners
    setupEventListeners();
    
    // Create initial track
    createTrack();
  }
  
  // Start initialization
  initialize();
});