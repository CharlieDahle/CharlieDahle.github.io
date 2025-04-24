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
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        buffers[name] = audioBuffer;
        console.log(`Loaded ${name} sound`);
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
    
    // Load all samples
    loadSample('kick.wav', 'kick');
    loadSample('snare.wav', 'snare');
    loadSample('hihat.wav', 'hihat');
    
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
    
    // Play/Pause button event listener
    playPauseBtn.addEventListener('click', togglePlay);
    
    // BPM slider event listener
    bpmSlider.addEventListener('input', updateTempo);
    
    // Clear button event listener
    clearButton.addEventListener('click', clearPatterns);
    
    // Spacebar to toggle play/pause
    document.addEventListener('keydown', (event) => {
      // Play/Pause with spacebar
      if (event.code === 'Space') {
        // Prevent spacebar from scrolling the page
        event.preventDefault();
        togglePlay();
      }
    });
  });