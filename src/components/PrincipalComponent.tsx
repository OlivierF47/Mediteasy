import { useState, useRef, useEffect } from 'react';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Filesystem, Directory } from '@capacitor/filesystem';
import './PrincipalComponent.css'

interface SoundOption {
  value: string;
  label: string;
  file?: string;
  isCustom?: boolean;
}

/* --------------------------------------------
  Static data: sounds, gongs, intervals, durations
-------------------------------------------- */

const soundOptions: SoundOption[] = [
  { value: 'silence', label: '🔇 Silence' },
  { value: 'rain', label: '🌧️ Rain', file: '/assets/ambients/rain.mp3' },
  { value: 'ocean', label: '🌊 Ocean', file: '/assets/ambients/ocean.mp3' },
  { value: 'birds', label: '🐦 Birds', file: '/assets/ambients/birds.mp3' },
];

const gongOptions = [
  { id: 'gong1', name: 'Japanese Gong', file: '/assets/gongs/studio_gong.wav' },
  { id: 'gong2', name: 'Zen Gong', file: '/assets/gongs/zen_gong.wav' },
  { id: 'gong3', name: 'Tibetan Bowl', file: '/assets/gongs/tibetian_bowl.mp3' },
  { id: 'gong4', name: 'Crystal Bowl', file: '/assets/gongs/crystal_bowl.mp3' },
];

const intervalOptions = [
  { value: 0, label: 'None' },
  { value: 5, label: 'Every 5 min' },
  { value: 10, label: 'Every 10 min' },
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
];

const durationOptions = [
  { value: 0, label: 'Undefined' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

/* --------------------------------------------
  Main component: MeditationTimer
-------------------------------------------- */

export default function MeditationTimer() {

  /* -------------------------
    Application states
  -------------------------- */

  const [selectedSound, setSelectedSound] = useState('silence');
  const [duration, setDuration] = useState(10);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [gongVolume, setGongVolume] = useState(0.7);
  const [selectedGong, setSelectedGong] = useState('gong1');
  const [gongInterval, setGongInterval] = useState(0);
  const [gongMoments, setGongMoments] = useState({ start: false, end: false });
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [nextGongIn, setNextGongIn] = useState(0);
  const [customSounds, setCustomSounds] = useState<SoundOption[]>([]);
  const [preparationTime, setPreparationTime] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const gongAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAmbientRef = useRef<HTMLAudioElement | null>(null);
  const previewGongRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gongTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preparationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previewAmbientTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* -------------------------
    Current selections
  -------------------------- */

  // Load custom sounds on startup
  useEffect(() => {
    const loadCustomSounds = async () => {
      try {
        const result = await Filesystem.readFile({
          path: 'custom-sounds.json',
          directory: Directory.Data,
        });

        if (result && typeof result.data === 'string') {
          const savedSounds = JSON.parse(result.data);
          setCustomSounds(savedSounds);
        } else {
          setCustomSounds([]); // No saved sounds
        }
      } catch (error) {
        console.error('Error loading custom sounds:', error);
        setCustomSounds([]); // No saved sounds
      }
    };
    loadCustomSounds();
  }, []);

  // Load dark mode preference on startup
  useEffect(() => {
    const loadDarkMode = async () => {
      try {
        const result = await Filesystem.readFile({
          path: 'dark-mode.json',
          directory: Directory.Data,
        });

        if (result && typeof result.data === 'string') {
          const { isDark } = JSON.parse(result.data);
          setIsDarkMode(isDark);
        }
      } catch (error) {
        console.log('No dark mode preference saved');
      }
    };
    loadDarkMode();
  }, []);

  // Save dark mode preference
  useEffect(() => {
    const saveDarkMode = async () => {
      try {
        await Filesystem.writeFile({
          path: 'dark-mode.json',
          data: JSON.stringify({ isDark: isDarkMode }),
          directory: Directory.Data,
        });
      } catch (error) {
        console.error('Error saving dark mode:', error);
      }
    };
    saveDarkMode();
  }, [isDarkMode]);

  // Apply dark-mode class to body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  // Save custom sounds
  const saveCustomSounds = async (sounds: SoundOption[]) => {
    await Filesystem.writeFile({
      path: 'custom-sounds.json',
      data: JSON.stringify(sounds),
      directory: Directory.Data,
    });
  };

  // Add a custom sound
  const addCustomSound = async () => {
    try {
      const result = await FilePicker.pickFiles({
        types: ['audio/*'],
        readData: true,
      });

      if (!result.files[0]) {
        console.log('No file selected');
        return;
      }

      const file = result.files[0];
      const soundId = `custom_${Date.now()}`;
      const fileName = `${soundId}.${file.name.split('.').pop()}`;
      const soundName = file.name.replace(/\.[^/.]+$/, ""); // Name without extension

      // Save the file to the filesystem
      await Filesystem.writeFile({
        path: `audio/${fileName}`,
        data: file.data ?? '',
        directory: Directory.Data,
      });

      // Create the custom sound object
      const newCustomSound: SoundOption = {
        value: soundId,
        label: `🎵 ${soundName}`,
        file: `audio/${fileName}`,
        isCustom: true
      };

      // Update the custom sounds list
      const updatedCustomSounds = [...customSounds, newCustomSound];
      setCustomSounds(updatedCustomSounds);
      
      // Save to persistent storage
      await saveCustomSounds(updatedCustomSounds);

      // Automatically select the new sound
      setSelectedSound(soundId);

      console.log(`Sound added and selected: ${soundName}`);
    } catch (error) {
      console.error('Error selecting or saving file:', error);
    }
  };

  // Remove a custom sound
  const removeCustomSound = async (soundId: string) => {
    try {
      // Find the sound to remove
      const soundToRemove = customSounds.find(sound => sound.value === soundId);
      if (!soundToRemove) return;

      // Ask for confirmation before deletion
      const confirmDelete = window.confirm(
        `Are you sure you want to delete the sound "${soundToRemove.label.replace('🎵 ', '')}"?\n\nThis action is irreversible.`
      );
      
      if (!confirmDelete) {
        return; 
      }

      // Delete the audio file from the filesystem
      if (soundToRemove.file) {
        try {
          await Filesystem.deleteFile({
            path: soundToRemove.file,
            directory: Directory.Data,
          });
        } catch (error) {
          console.warn('Unable to delete audio file:', error);
        }
      }

      // Update the custom sounds list
      const updatedCustomSounds = customSounds.filter(sound => sound.value !== soundId);
      setCustomSounds(updatedCustomSounds);
      
      // Save to persistent storage
      await saveCustomSounds(updatedCustomSounds);

      // If the deleted sound was selected, return to silence
      if (selectedSound === soundId) {
        setSelectedSound('silence');
      }

      console.log(`Sound removed: ${soundToRemove.label}`);
    } catch (error) {
      console.error('Error removing custom sound:', error);
    }
  };

  const allSounds = [...soundOptions, ...customSounds];
  const selectedSoundOption = allSounds.find((s) => s.value === selectedSound);
  const selectedGongOption = gongOptions.find((g) => g.id === selectedGong);

  /* -------------------------
    Sound preview with automatic playback
  -------------------------- */

// Utility function to apply fade out
const fadeOut = (audio: HTMLAudioElement, duration: number = 1000) => {
  const startVolume = audio.volume;
  const fadeInterval = 50; // Update every 50ms
  const steps = duration / fadeInterval;
  const volumeStep = startVolume / steps;
  
  const fade = setInterval(() => {
    if (audio.volume > volumeStep) {
      audio.volume = Math.max(0, audio.volume - volumeStep);
    } else {
      audio.volume = 0;
      audio.pause();
      clearInterval(fade);
    }
  }, fadeInterval);
  
  return fade;
};

// Function to preview an ambient sound
const previewAmbientSound = (soundValue: string) => {
  // Stop any current preview with fade
  if (previewAmbientRef.current) {
    fadeOut(previewAmbientRef.current, 500);
    previewAmbientRef.current = null;
  }
  
  // Clear old timeout
  if (previewAmbientTimeoutRef.current) {
    clearTimeout(previewAmbientTimeoutRef.current);
    previewAmbientTimeoutRef.current = null;
  }
  
  // Find the selected sound file
  const soundOption = allSounds.find(s => s.value === soundValue);
  
  // Don't preview silence
  if (soundValue === 'silence' || !soundOption?.file) return;
  
  // Create and play the new preview sound
  const audio = new Audio(soundOption.file);
  audio.volume = volume;
  audio.loop = false;
  previewAmbientRef.current = audio;
  audio.play().catch(err => {
    console.error('Error playing preview:', err);
  });
  
  // Stop preview after 8 seconds with 2 second fade
  previewAmbientTimeoutRef.current = setTimeout(() => {
    if (previewAmbientRef.current) {
      fadeOut(previewAmbientRef.current, 2000);
      previewAmbientRef.current = null;
    }
  }, 6000); // 6 seconds before fade (6s + 2s fade = 8s total)
};

// Function to preview a gong
const previewGong = (gongId: string) => {
  // Stop any current preview with fade
  if (previewGongRef.current) {
    fadeOut(previewGongRef.current, 300);
    previewGongRef.current = null;
  }
  
  const gongOption = gongOptions.find((g) => g.id === gongId);
  if (!gongOption?.file) return;
  
  // Create and play the new gong preview
  const audio = new Audio(gongOption.file);
  audio.volume = gongVolume;
  previewGongRef.current = audio;
  audio.play().catch(err => {
    console.error('Error playing gong preview:', err);
  });
};

// Cleanup previews on component unmount
useEffect(() => {
  return () => {
    if (previewAmbientTimeoutRef.current) {
      clearTimeout(previewAmbientTimeoutRef.current);
    }
    if (previewAmbientRef.current) {
      fadeOut(previewAmbientRef.current, 500);
    }
    if (previewGongRef.current) {
      fadeOut(previewGongRef.current, 300);
    }
  };
}, []);

// Real-time volume adjustment for ambient sound preview
useEffect(() => {
  if (previewAmbientRef.current) {
    previewAmbientRef.current.volume = volume;
  }
}, [volume]);

// Real-time volume adjustment for gong preview
useEffect(() => {
  if (previewGongRef.current) {
    previewGongRef.current.volume = gongVolume;
  }
}, [gongVolume]);

  /* -------------------------
    Timer logic
  -------------------------- */

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const playGong = () => {
    if (gongAudioRef.current) {
      gongAudioRef.current.currentTime = 0;
      gongAudioRef.current.volume = gongVolume;
      gongAudioRef.current.play();
    }
  };

  const handlePlay = () => {
    // Stop all previews
    if (previewAmbientRef.current) {
      previewAmbientRef.current.pause();
      previewAmbientRef.current = null;
    }
    if (previewGongRef.current) {
      previewGongRef.current.pause();
      previewGongRef.current = null;
    }

    setIsFinished(false);
    setIsPreparing(true);
    setPreparationTime(10);

    let countdown = 10;
    preparationTimerRef.current = setInterval(() => {
      countdown--;
      setPreparationTime(countdown);
      if (countdown === 0) {
        clearInterval(preparationTimerRef.current!);
        setIsPreparing(false);
        startMeditation();
      }
    }, 1000);
  };

  const startMeditation = () => {
    setIsPlaying(true);
    setTimeRemaining(duration * 60);
    setTimeElapsed(0);
    setNextGongIn(gongInterval > 0 ? gongInterval * 60 : 0);

    if (gongMoments.start) {
      playGong();
    }

    if (selectedSound !== 'silence' && ambientAudioRef.current) {
      ambientAudioRef.current.volume = volume;
      ambientAudioRef.current.play();
    }

    // For undefined duration (duration === 0), count up instead of down
    if (duration === 0) {
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    if (gongInterval > 0) {
      gongTimerRef.current = setInterval(() => {
        setNextGongIn((prev) => {
          if (prev <= 1) {
            playGong();
            return gongInterval * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    setIsPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (gongTimerRef.current) clearInterval(gongTimerRef.current);
    if (ambientAudioRef.current) ambientAudioRef.current.pause();
  };

  const handleResume = () => {
    setIsPaused(false);
    setIsPlaying(true);

    if (selectedSound !== 'silence' && ambientAudioRef.current) {
      ambientAudioRef.current.play();
    }

    // For undefined duration, continue counting up
    if (duration === 0) {
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    if (gongInterval > 0) {
      gongTimerRef.current = setInterval(() => {
        setNextGongIn((prev) => {
          if (prev <= 1) {
            playGong();
            return gongInterval * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setIsPaused(false);
    setTimeRemaining(0);
    setNextGongIn(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (gongTimerRef.current) clearInterval(gongTimerRef.current);
    if (ambientAudioRef.current) {
      ambientAudioRef.current.pause();
      ambientAudioRef.current.currentTime = 0;
    }
  };

  const handleEnd = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (gongTimerRef.current) clearInterval(gongTimerRef.current);

    if (gongMoments.end) {
      playGong();
    }

    if (ambientAudioRef.current) {
      ambientAudioRef.current.pause();
      ambientAudioRef.current.currentTime = 0;
    }

    setIsPlaying(false);
    setIsFinished(true);
  };

  /* --------------------------
    Custom duration management
  -------------------------- */

  const handleAddCustomDuration = () => {
    const minutes = parseInt(customMinutes, 10);
    if (!isNaN(minutes) && minutes >= 1 && minutes <= 180) {
      setDuration(minutes);
      setShowCustomInput(false);
      setCustomMinutes('');
    }
  };

  /* -------------------------
    User Interface (UI)
  -------------------------- */

  return (
    <div className="app">
      <div className="container">

        {/* Dark Mode Button */}
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="btn-dark-mode"
          title={isDarkMode ? "Light mode" : "Dark mode"}
          aria-label={isDarkMode ? "Activate light mode" : "Activate dark mode"}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        {/* Logo only */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <img src="/mediteasy.svg" alt="Mediteasy logo" style={{ height: '190px', width: 'auto' }} /> 
        </div>


        {/* Hidden audio files */}
        {selectedSound !== 'silence' && selectedSoundOption?.file && (
          <audio
            ref={ambientAudioRef}
            loop
            preload="auto"
            src={selectedSoundOption.file}
          />
        )}

        {selectedGongOption && (
          <audio
            ref={gongAudioRef}
            preload="auto"
            src={selectedGongOption.file}
          />
        )}

        {/* Preparation phase */}
        {isPreparing && (
          <div className="section">
            <div className="preparation-container">
              <div className="preparation-circle">
                <svg className="preparation-svg" viewBox="0 0 200 200">
                  <defs>
                    <linearGradient id="preparationGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3dcac3" />
                      <stop offset="100%" stopColor="#428b6a" />
                    </linearGradient>
                  </defs>
                  <circle
                    className="preparation-ring-bg"
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    opacity="0.2"
                  />
                  <circle
                    className="preparation-ring"
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="url(#preparationGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="565.48"
                    style={{
                      strokeDashoffset: `${565.48 * (preparationTime / 10)}`,
                      transition: 'stroke-dashoffset 1s linear'
                    }}
                  />
                </svg>
                <div className="preparation-content">
                  <div className="preparation-number">{preparationTime}</div>
                  <div className="preparation-emoji">🧘</div>
                </div>
              </div>
              <div className="text-muted preparation-text">Get ready...</div>
            </div>
          </div>
        )}

        {/* Display during meditation or paused */}
        {(isPlaying || isPaused) && (
          <div className="section">
            <div className="time-display">
              {duration === 0 ? formatTime(timeElapsed) : formatTime(timeRemaining)}
            </div>
            <div className="text-muted">
              {isPaused ? '⏸️ Paused' : (duration === 0 ? 'Time elapsed' : 'Time remaining')}
            </div>
            {gongInterval > 0 && nextGongIn > 0 && !isPaused && (
              <div className="text-muted">
                🔔 Next gong in {formatTime(nextGongIn)}
              </div>
            )}
          </div>
        )}

        {/* Configuration before start */}
        {!isPlaying && !isPaused && !isFinished && !isPreparing && (
          <>
            {/* Ambient sound */}
            <div className="section compact">
              <div className="control-row">
                <span className="control-icon">🎵</span>
                <select
                  value={selectedSound}
                  onChange={(e) => {
                    const value = e.target.value;
                    if(value === "custom"){
                      e.target.value = selectedSound;
                      addCustomSound();
                    } else {
                      setSelectedSound(value);
                      // Preview sound only if not meditating
                      if (!isPlaying && !isPaused && !isPreparing) {
                        previewAmbientSound(value);
                      }
                    }
                  }}
                  className="select compact" 
                >
                  {soundOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                  {customSounds.map((s) =>(
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                  <option value="custom">⬇️ Add custom sound</option>
                </select>
                {selectedSoundOption?.isCustom && (
                  <button 
                    onClick={() => removeCustomSound(selectedSound)} 
                    className="btn-delete"
                    title="Delete this sound"
                  >
                    <img src="/assets/images/trash.svg" alt="Delete" />
                  </button>
                )}
              </div>

              {selectedSound !== 'silence' && (
                <div className="volume-control">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="range compact"
                  />
                  <span className="volume-label">{Math.round(volume * 100)}%</span>
                </div>
              )}
            </div>

            {/* Meditation gong */}
            <div className="section compact">
              <div className="control-row">
                <span className="control-icon">🔔</span>
                <select
                  value={selectedGong}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedGong(value);
                    // Preview gong only if not meditating
                    if (!isPlaying && !isPaused && !isPreparing) {
                      previewGong(value);
                    }
                  }}
                  className="select compact"
                >
                  {gongOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="volume-control">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={gongVolume}
                  onChange={(e) => setGongVolume(parseFloat(e.target.value))}
                  className="range compact"
                />
                <span className="volume-label">{Math.round(gongVolume * 100)}%</span>
              </div>

              <div className="control-row">
                <span className="control-icon">⏱️</span>
                <select
                  value={gongInterval}
                  onChange={(e) => setGongInterval(parseInt(e.target.value))}
                  className="select compact"
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="checkbox-row">
                <label className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={gongMoments.start}
                    onChange={(e) =>
                      setGongMoments({ ...gongMoments, start: e.target.checked })
                    }
                  />
                  🔔 Start
                </label>
                <label className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={gongMoments.end}
                    onChange={(e) =>
                      setGongMoments({ ...gongMoments, end: e.target.checked })
                    }
                  />
                  🔔 End
                </label>
              </div>
            </div>

            {/* Meditation duration */}
            <div className="section compact">
              <div className="control-row">
                <span className="control-icon">⏳</span>
                {!showCustomInput ? (
                  <>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="select compact duration-select"
                    >
                      {durationOptions.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowCustomInput(true)}
                      className="btn btn-secondary compact"
                    >
                      ➕ Customize
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      placeholder="1-180"
                      min="1"
                      max="180"
                      className="input compact custom-duration-input"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleAddCustomDuration();
                      }}
                    />
                    <button onClick={handleAddCustomDuration} className="btn btn-primary compact custom-btn">
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setShowCustomInput(false);
                        setCustomMinutes('');
                      }}
                      className="btn btn-secondary compact custom-btn"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Start / Pause / Resume / Stop buttons */}
        <div className="section">
          {!isPlaying && !isPaused && !isPreparing && (
            <button onClick={handlePlay} className="btn btn-primary">
              {isFinished ? '🔄 Restart' : '▶️ Start'}
            </button>
          )}
          {isPaused && (
            <button onClick={handleResume} className="btn btn-primary">
              ▶️ Resume
            </button>
          )}
          {isPlaying && (
            <>
              <button onClick={handlePause} className="btn btn-secondary">
                ⏸️ Pause
              </button>
              <button onClick={handleStop} className="btn btn-secondary">
                ⏹️ Stop
              </button>
            </>
          )}
          {isPaused && (
            <button onClick={handleStop} className="btn btn-secondary">
              ⏹️ Stop
            </button>
          )}
        </div>

        {/* Session end */}
        {isFinished && (
          <div className="section">
            <div className="emoji">✨</div>
            <div className="title-section">Meditation completed!</div>
          </div>
        )}
      </div>
    </div>
  );
}