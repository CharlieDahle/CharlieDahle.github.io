document.addEventListener('DOMContentLoaded', () => {
  // Audio Context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Constants
  let BPM = 120;
  const STEPS = 32; // 16th notes for two measures (2 * 16)
  const MINUTE = 60000; // ms
  let SIXTEENTH_NOTE = MINUTE / BPM / 4; // Duration of a 16th note in ms
  
  // State
  let isPlaying = false;
  let currentStep = 0;
  let intervalId = null;
  let soundManifest = null;
  
  // Current selected sounds
  const currentSounds = {
    kick: { name: 'Kick 1', file: 'kicks/kick1.wav' },
    snare: { name: 'Snare 1', file: 'snares/snare1.wav' },
    hihat: { name: 'Closed Hat', file: 'hihats/closed.wav' }
  };
  
  // Buffers for our drum sounds
  const buffers = {
    kick: null,
    snare: null,
    hihat: null
  };
  
  // Patterns - 32 steps (16th notes for 2 measures)
  const patterns = {
    kick: new Array(STEPS).fill(false),
    snare: new Array(STEPS).fill(false),
    hihat: new Array(STEPS).fill(false)
  };
  
  // DOM elements
  const playPauseBtn = document.getElementById('play-pause');
  const bpmSlider = document.getElementById('bpm-slider');
  const bpmValue = document.getElementById('bpm-value');
  const clearButton = document.getElementById('clear-button');
  const kickTrack = document.getElementById('kick-track');
  const snareTrack = document.getElementById('snare-track');
  const hihatTrack = document.getElementById('hihat-track');
  
  // Fetch sound manifest
  async function fetchSoundManifest() {
    try {
      const response = await fetch('drum-sounds.json');
      soundManifest = response.ok ? await response.json() : null;
      
      if (soundManifest) {
        console.log('Loaded sound manifest:', soundManifest);
      } else {
        console.error('Failed to load sound manifest');
        alert('Could not load sound library. Using default sounds.');
      }
      
      return soundManifest;
    } catch (error) {
      console.error('Error loading sound manifest:', error);
      alert('Could not load sound library. Using default sounds.');
      return null;
    }
  }
  
  // Create a simpler dropdown for each sound selector
  function setupSoundDropdowns() {
    const soundSelects = document.querySelectorAll('.sound-select');
    const categoryMap = { kick: 'kicks', snare: 'snares', hihat: 'hihats' };
    
    soundSelects.forEach(select => {
      const instrument = select.dataset.instrument;
      const category = categoryMap[instrument];
      
      // Create dropdown element
      const dropdown = document.createElement('div');
      dropdown.className = 'sound-dropdown';
      dropdown.style.display = 'none';
      
      // Populate dropdown with sounds from manifest
      if (soundManifest && soundManifest[category]) {
        soundManifest[category].forEach(sound => {
          const option = document.createElement('div');
          option.className = 'sound-option';
          option.textContent = sound.name;
          option.addEventListener('click', () => {
            // Update the selected sound
            currentSounds[instrument] = { name: sound.name, file: sound.file };
            
            // Update display text
            select.querySelector('.sound-name').textContent = sound.name;
            
            // Load the sound
            loadSample(sound.file, instrument);
            
            // Hide dropdown
            dropdown.style.display = 'none';
          });
          
          dropdown.appendChild(option);
        });
      }
      
      // Add dropdown to select element
      select.appendChild(dropdown);
      
      // Toggle dropdown on click
      select.addEventListener('click', (e) => {
        // Skip if clicking on a dropdown option
        if (e.target.classList.contains('sound-option')) return;
        
        // Hide all other dropdowns
        document.querySelectorAll('.sound-dropdown').forEach(d => {
          if (d !== dropdown) d.style.display = 'none';
        });
        
        // Toggle this dropdown
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      });
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
  
  // Function to create step buttons for a track
  function createStepButtons(trackElement, instrument) {
    for (let i = 0; i < STEPS; i++) {
      const step = document.createElement('button');
      step.className = 'step';
      step.dataset.step = i;
      
      // Every 4 steps (quarter note), add visual indicator
      if (i % 4 === 0) {
        step.style.borderLeftWidth = '3px';
      }
      
      // Toggle step active state on click
      step.addEventListener('click', () => {
        patterns[instrument][i] = !patterns[instrument][i];
        step.classList.toggle('active', patterns[instrument][i]);
      });
      
      trackElement.appendChild(step);
    }
  }
  
  // Create step buttons for all tracks
  createStepButtons(kickTrack, 'kick');
  createStepButtons(snareTrack, 'snare');
  createStepButtons(hihatTrack, 'hihat');
  
  // Load audio samples
  async function loadSample(url, name) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        buffers[name] = audioBuffer;
        console.log(`Loaded ${name} sound: ${url}`);
      } else {
        console.error(`Failed to load ${name} sound: ${response.status}`);
      }
    } catch (error) {
      console.error(`Error loading ${name} sound:`, error);
    }
  }
  
  // Play a sample
  function playSample(name) {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    if (buffers[name]) {
      const source = audioContext.createBufferSource();
      source.buffer = buffers[name];
      source.connect(audioContext.destination);
      source.start(0);
    }
  }
  
  // Load initial drum sounds
  function loadInitialSounds() {
    Object.keys(currentSounds).forEach(instrument => {
      loadSample(currentSounds[instrument].file, instrument);
    });
  }
  
  // Update the step visuals across all tracks
  function updateStepVisuals() {
    // Remove current step indicator from all steps
    document.querySelectorAll('.step').forEach(step => {
      step.classList.remove('current');
    });
    
    // Add current step indicator to each track
    kickTrack.querySelector(`[data-step="${currentStep}"]`).classList.add('current');
    snareTrack.querySelector(`[data-step="${currentStep}"]`).classList.add('current');
    hihatTrack.querySelector(`[data-step="${currentStep}"]`).classList.add('current');
  }
  
  // Sequencer player function
  function step() {
    // Update the step visuals
    updateStepVisuals();
    
    // Play the active sounds for this step for each instrument
    if (patterns.kick[currentStep]) {
      playSample('kick');
    }
    if (patterns.snare[currentStep]) {
      playSample('snare');
    }
    if (patterns.hihat[currentStep]) {
      playSample('hihat');
    }
    
    // Move to next step
    currentStep = (currentStep + 1) % STEPS;
  }
  
  // Play/Pause functionality
  function togglePlay() {
    if (!isPlaying) {
      // Make sure the audio context is running
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Start playback
      isPlaying = true;
      playPauseBtn.textContent = 'Pause';
      
      // Initial step (immediate)
      step();
      
      // Continue with regular interval
      intervalId = setInterval(step, SIXTEENTH_NOTE);
    } else {
      // Stop playback
      isPlaying = false;
      playPauseBtn.textContent = 'Play';
      clearInterval(intervalId);
      
      // Clear current step indicator
      document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('current');
      });
      
      // Reset step counter
      currentStep = 0;
    }
  }
  
  // Update tempo based on slider
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
    // Reset all patterns to false
    for (const instrument in patterns) {
      patterns[instrument].fill(false);
    }
    
    // Remove 'active' class from all steps
    document.querySelectorAll('.step').forEach(step => {
      step.classList.remove('active');
    });
  }
  
  // Initialize the app
  async function initialize() {
    // First fetch the sound manifest
    soundManifest = await fetchSoundManifest();
    
    // Set up sound dropdowns
    setupSoundDropdowns();
    
    // Load initial sounds
    loadInitialSounds();
    
    // Set up event listeners
    playPauseBtn.addEventListener('click', togglePlay);
    bpmSlider.addEventListener('input', updateTempo);
    clearButton.addEventListener('click', clearPatterns);
    
    // Spacebar to toggle play/pause
    document.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
    });
  }
  
  // Start initialization
  initialize();
});