document.addEventListener('DOMContentLoaded', () => {
  // Audio Context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Constants
  let BPM = 120;
  const STEPS = 32; // 16th notes for two measures (2 * 16)
  const MINUTE = 60000; // ms
  let SIXTEENTH_NOTE = MINUTE / BPM / 4; // Duration of a 16th note in ms
  const MAX_TRACKS = 10;
  
  // State
  let isPlaying = false;
  let currentStep = 0;
  let intervalId = null;
  let soundManifest = null;
  
  // Tracks management
  const tracks = [];
  
  // DOM Elements
  const addTrackButton = document.getElementById('add-track-button');
  const soundSelectionContainer = document.getElementById('sound-selection-container');
  const sequencerContainer = document.getElementById('sequencer-container');
  const playPauseBtn = document.getElementById('play-pause');
  const bpmSlider = document.getElementById('bpm-slider');
  const bpmValue = document.getElementById('bpm-value');
  const clearButton = document.getElementById('clear-button');
  
  // Track Class
  class Track {
    constructor(id) {
      this.id = id;
      this.category = null;
      this.sound = null;
      this.pattern = new Array(STEPS).fill(false);
      this.buffer = null;
    }
    
    // Load sound for this track
    async loadSound() {
      if (!this.sound) return;
      
      try {
        const response = await fetch(this.sound.file);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          this.buffer = await audioContext.decodeAudioData(arrayBuffer);
          console.log(`Loaded sound for track ${this.id}: ${this.sound.name}`);
        } else {
          console.error(`Failed to load sound for track ${this.id}`);
        }
      } catch (error) {
        console.error(`Error loading sound for track ${this.id}:`, error);
      }
    }
    
    // Play sound for this track
    play() {
      if (this.buffer) {
        const source = audioContext.createBufferSource();
        source.buffer = this.buffer;
        source.connect(audioContext.destination);
        source.start(0);
      }
    }
  }
  
  // Fetch sound manifest
  async function fetchSoundManifest() {
    try {
      const response = await fetch('drum-sounds.json');
      soundManifest = response.ok ? await response.json() : null;
      
      if (soundManifest) {
        console.log('Loaded sound manifest');
      } else {
        console.error('Failed to load sound manifest');
        alert('Could not load sound library.');
      }
      
      return soundManifest;
    } catch (error) {
      console.error('Error loading sound manifest:', error);
      alert('Could not load sound library.');
      return null;
    }
  }
  
  // Create instrument category dropdown
  function createCategoryDropdown(track) {
    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'sound-dropdown category-dropdown';
    dropdown.style.display = 'none';
    
    // Get all categories from sound manifest
    const categories = Object.keys(soundManifest);
    
    // Populate dropdown with categories
    categories.forEach(category => {
      const option = document.createElement('div');
      option.className = 'sound-option';
      option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      option.addEventListener('click', (e) => {
        // Find the closest sound-select element
        const soundSelect = e.target.closest('.sound-select');
        if (!soundSelect) return;
        
        // Update track category
        track.category = category;
        
        // Reset sound
        track.sound = null;
        
        // Update display
        const soundNameEl = soundSelect.querySelector('.sound-name');
        const instrumentNameEl = soundSelect.querySelector('.instrument-name');
        if (soundNameEl) {
          soundNameEl.textContent = 'Select Sound';
        }
        if (instrumentNameEl) {
          instrumentNameEl.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)}:`;
        }
        
        // Remove existing sound dropdown
        const existingDropdown = soundSelect.querySelector('.sound-dropdown:not(.category-dropdown)');
        if (existingDropdown) {
          existingDropdown.remove();
        }
        
        // Create sound dropdown for selected category
        const soundDropdown = createSoundDropdown(track, category);
        soundSelect.appendChild(soundDropdown);
        
        // Hide category dropdown
        dropdown.style.display = 'none';
      });
      
      dropdown.appendChild(option);
    });
    
    return dropdown;
  }
  
  // Create sound dropdown for a specific category
  function createSoundDropdown(track, category) {
    // Create dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'sound-dropdown';
    dropdown.style.display = 'none';
    
    // Populate dropdown with sounds from selected category
    if (soundManifest && soundManifest[category]) {
      soundManifest[category].forEach(sound => {
        const option = document.createElement('div');
        option.className = 'sound-option';
        option.textContent = sound.name;
        option.addEventListener('click', (e) => {
          // Find the closest sound-select element
          const soundSelect = e.target.closest('.sound-select');
          if (!soundSelect) return;
          
          // Update track sound
          track.sound = sound;
          
          // Update display
          const soundNameEl = soundSelect.querySelector('.sound-name');
          if (soundNameEl) {
            soundNameEl.textContent = sound.name;
          }
          
          // Load new sound
          track.loadSound();
          
          // Hide dropdown
          dropdown.style.display = 'none';
        });
        
        dropdown.appendChild(option);
      });
    }
    
    return dropdown;
  }
  
  // Create a new track
  function createTrack() {
    // Check max tracks limit
    if (tracks.length >= MAX_TRACKS) {
      alert(`Maximum of ${MAX_TRACKS} tracks reached.`);
      return;
    }
    
    // Create track
    const trackId = tracks.length + 1;
    const newTrack = new Track(trackId);
    tracks.push(newTrack);
    
    // Create track in sequencer
    const trackTemplate = document.getElementById('track-template');
    const trackElement = trackTemplate.content.cloneNode(true).querySelector('.track');
    trackElement.dataset.trackId = trackId;
    trackElement.querySelector('.track-name').textContent = `Track ${trackId}`;
    
    // Create steps for this track
    const trackSteps = trackElement.querySelector('.track-steps');
    for (let i = 0; i < STEPS; i++) {
      const step = document.createElement('button');
      step.className = 'step';
      step.dataset.step = i;
      step.dataset.trackColor = trackId;
      
      // Add visual indicator for quarter notes
      if (i % 4 === 0) {
        step.style.borderLeftWidth = '3px';
      }
      
      // Toggle step on click
      step.addEventListener('click', () => {
        const track = tracks.find(t => t.id === trackId);
        track.pattern[i] = !track.pattern[i];
        step.classList.toggle('active', track.pattern[i]);
      });
      
      trackSteps.appendChild(step);
    }
    
    // Add remove track functionality
    const removeButton = trackElement.querySelector('.btn-remove-track');
    removeButton.addEventListener('click', () => {
      // Remove from tracks array
      const index = tracks.findIndex(t => t.id === trackId);
      if (index !== -1) {
        tracks.splice(index, 1);
      }
      
      // Remove from DOM
      trackElement.remove();
      
      // Remove sound selector
      const soundSelector = document.querySelector(`.sound-select[data-track-id="${trackId}"]`);
      if (soundSelector) {
        soundSelector.remove();
      }
    });
    
    // Create sound selector
    const soundSelectTemplate = document.getElementById('sound-select-template');
    const soundSelect = soundSelectTemplate.content.cloneNode(true).querySelector('.sound-select');
    soundSelect.dataset.trackId = trackId;
    
    // Update sound name display
    soundSelect.querySelector('.sound-name').textContent = 'Select Category';
    
    // Populate category dropdown
    const categoryDropdown = createCategoryDropdown(newTrack);
    soundSelect.appendChild(categoryDropdown);
    
    // Toggle dropdown functionality
    soundSelect.addEventListener('click', (e) => {
      // Skip if clicking on a dropdown option
      if (e.target.classList.contains('sound-option')) return;
      
      // Determine which dropdown to toggle
      const categoryDropdown = soundSelect.querySelector('.category-dropdown');
      const soundDropdown = soundSelect.querySelector('.sound-dropdown:not(.category-dropdown)');
      
      // Hide all other dropdowns
      document.querySelectorAll('.sound-dropdown').forEach(d => {
        if (d !== categoryDropdown && d !== soundDropdown) {
          d.style.display = 'none';
        }
      });
      
      // Toggle appropriate dropdown
      if (soundSelect.querySelector('.sound-name').textContent === 'Select Category') {
        categoryDropdown.style.display = categoryDropdown.style.display === 'none' ? 'block' : 'none';
      } else if (soundDropdown) {
        soundDropdown.style.display = soundDropdown.style.display === 'none' ? 'block' : 'none';
      }
    });
    
    // Add to DOM
    sequencerContainer.appendChild(trackElement);
    soundSelectionContainer.appendChild(soundSelect);
    
    return newTrack;
  }
  
  // Rest of the code remains the same as in the previous implementation...
  
  // Step function for sequencer
  function step() {
    // Update step visuals
    const currentSteps = document.querySelectorAll(`.step[data-step="${currentStep}"]`);
    document.querySelectorAll('.step.current').forEach(step => {
      step.classList.remove('current');
    });
    currentSteps.forEach(step => {
      step.classList.add('current');
    });
    
    // Play active sounds
    tracks.forEach(track => {
      if (track.pattern[currentStep] && track.sound) {
        track.play();
      }
    });
    
    // Move to next step
    currentStep = (currentStep + 1) % STEPS;
  }
  
  // Play/Pause functionality
  function togglePlay() {
    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    if (!isPlaying) {
      // Start playback
      isPlaying = true;
      playPauseBtn.textContent = 'Pause';
      
      // Initial step (immediate)
      step();
      
      // Continue with regular interval
      intervalId = setInterval(step, SIXTEENTH_NOTE);
    } else {
      // Stop playback
      stopSequencer();
    }
  }
  
  // Stop sequencer
  function stopSequencer() {
    isPlaying = false;
    playPauseBtn.textContent = 'Play';
    clearInterval(intervalId);
    
    // Clear current step indicator
    document.querySelectorAll('.step.current').forEach(step => {
      step.classList.remove('current');
    });
    
    // Reset step counter
    currentStep = 0;
  }
  
  // Update tempo
  function updateTempo() {
    BPM = parseInt(bpmSlider.value);
    bpmValue.textContent = BPM;
    SIXTEENTH_NOTE = MINUTE / BPM / 4;
    
    // If playing, restart the interval with new timing
    if (isPlaying) {
      clearInterval(intervalId);
      intervalId = setInterval(step, SIXTEENTH_NOTE);
    }
  }
  
  // Clear all patterns
  function clearPatterns() {
    tracks.forEach(track => {
      track.pattern.fill(false);
    });
    
    // Remove 'active' class from all steps
    document.querySelectorAll('.step.active').forEach(step => {
      step.classList.remove('active');
    });
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Transport controls
    playPauseBtn.addEventListener('click', togglePlay);
    bpmSlider.addEventListener('input', updateTempo);
    clearButton.addEventListener('click', clearPatterns);
    addTrackButton.addEventListener('click', createTrack);
    
    // Keyboard controls
    document.addEventListener('keydown', (event) => {
      // Spacebar to toggle play/pause
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
      
      // Escape key to stop playback
      if (event.code === 'Escape' && isPlaying) {
        event.preventDefault();
        stopSequencer();
      }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.sound-select')) {
        document.querySelectorAll('.sound-dropdown').forEach(d => {
          d.style.display = 'none';
        });
      }
    });
  }
  
  // Initialize the app
  async function initialize() {
    // Fetch sound manifest
    await fetchSoundManifest();
    
    // Set up event listeners
    setupEventListeners();
    
    // Create initial track
    createTrack();
  }
  
  // Start initialization
  initialize();
});