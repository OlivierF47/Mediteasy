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
  Données statiques : sons, gongs, intervalles, durées
-------------------------------------------- */

const soundOptions: SoundOption[] = [
  { value: 'silence', label: '🔇 Silence' },
  { value: 'rain', label: '🌧️ Pluie', file: '/assets/ambients/rain.mp3' },
  { value: 'ocean', label: '🌊 Ocean', file: '/assets/ambients/ocean.mp3' },
  { value: 'birds', label: '🐦 Oiseaux', file: '/assets/ambients/birds.mp3' },
  { value: 'calm_mind', label: '🧠 Esprit Calme', file: '/assets/ambients/calm_mind.mp3' },
  { value: 'travel_flute', label: '🎋 Flûte Voyage', file: '/assets/ambients/travel_flute.mp3' },
];

const gongOptions = [
  { id: 'gong1', name: 'Gong Japonais', file: '/assets/gongs/studio_gong.wav' },
  { id: 'gong2', name: 'Gong Zen', file: '/assets/gongs/zen_gong.wav' },
  { id: 'gong3', name: 'Bol Tibétain', file: '/assets/gongs/tibetian_bowl.mp3' },
  { id: 'gong4', name: 'Bol en cristal', file: '/assets/gongs/crystal_bowl.mp3' },
];

const intervalOptions = [
  { value: 0, label: 'Aucun' },
  { value: 5, label: 'Toutes les 5 min' },
  { value: 10, label: 'Toutes les 10 min' },
  { value: 15, label: 'Toutes les 15 min' },
  { value: 30, label: 'Toutes les 30 min' },
];

const durationOptions = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

/* --------------------------------------------
  Composant principal : MeditationTimer
-------------------------------------------- */

export default function MeditationTimer() {

  /* -------------------------
    États de l'application
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
  const [nextGongIn, setNextGongIn] = useState(0);
  const [customSounds, setCustomSounds] = useState<SoundOption[]>([]);
  const [preparationTime, setPreparationTime] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);

  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const gongAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAmbientRef = useRef<HTMLAudioElement | null>(null);
  const previewGongRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gongTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preparationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previewAmbientTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* -------------------------
    Sélections actuelles
  -------------------------- */

  // Charger les sons personnalisés au démarrage
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
          setCustomSounds([]); // Aucun son sauvegardé
        }
      } catch (error) {
        console.error('Erreur lors du chargement des sons personnalisés :', error);
        setCustomSounds([]); // Aucun son sauvegardé
      }
    };
    loadCustomSounds();
  }, []);

  // Sauvegarder les sons personnalisés
  const saveCustomSounds = async (sounds: SoundOption[]) => {
    await Filesystem.writeFile({
      path: 'custom-sounds.json',
      data: JSON.stringify(sounds),
      directory: Directory.Data,
    });
  };

  // Ajouter un son personnalisé
  const addCustomSound = async () => {
    try {
      console.log('🎵 Début addCustomSound');
      
      const result = await FilePicker.pickFiles({
        types: ['audio/*'],
        readData: true,
      });

      console.log('📁 Résultat FilePicker:', result);

      if (!result.files || result.files.length === 0) {
        console.log('❌ Aucun fichier sélectionné');
        return;
      }

      const file = result.files[0];
      console.log('📄 Fichier:', file);
      
      const soundId = `custom_${Date.now()}`;
      const fileName = `${soundId}.${file.name.split('.').pop()}`;
      const soundName = file.name.replace(/\.[^/.]+$/, ""); // Nom sans extension

      console.log('💾 Préparation sauvegarde:', fileName);

      // Stratégie différente selon la plateforme
      let fileData: string;
      
      if (file.data) {
        // Web ou données base64 disponibles
        console.log('📄 Utilisation des données base64');
        fileData = file.data;
      } else if (file.path) {
        // Android - lire depuis le path
        console.log('📁 Lecture depuis path:', file.path);
        const sourceFile = await Filesystem.readFile({
          path: file.path
        });
        fileData = typeof sourceFile.data === 'string' ? sourceFile.data : '';
        if (!fileData) {
          console.error('❌ Impossible de convertir les données en string');
          alert('Erreur de format de fichier');
          return;
        }
      } else {
        console.error('❌ Aucune donnée disponible');
        alert('Impossible de lire le fichier audio');
        return;
      }

      // Sauvegarder le fichier
      await Filesystem.writeFile({
        path: `audio/${fileName}`,
        data: fileData,
        directory: Directory.Data,
      });

      console.log('✅ Fichier sauvegardé');

      // Obtenir l'URI pour la lecture
      const fileUri = await Filesystem.getUri({
        path: `audio/${fileName}`,
        directory: Directory.Data,
      });

      // Créer l'objet son personnalisé
      const newCustomSound: SoundOption = {
        value: soundId,
        label: `🎵 ${soundName}`,
        file: fileUri.uri, // Utiliser l'URI complet
        isCustom: true
      };

      // Mettre à jour la liste des sons personnalisés
      const updatedCustomSounds = [...customSounds, newCustomSound];
      setCustomSounds(updatedCustomSounds);
      
      // Sauvegarder dans le stockage persistant
      await saveCustomSounds(updatedCustomSounds);

      // Sélectionner automatiquement le nouveau son
      setSelectedSound(soundId);

      console.log(`Son ajouté et sélectionné : ${soundName}`);
    } catch (error) {
      console.error('Erreur lors de la sélection ou de la sauvegarde du fichier :', error);
    }
  };

  // Supprimer un son personnalisé
  const removeCustomSound = async (soundId: string) => {
    try {
      // Trouver le son à supprimer
      const soundToRemove = customSounds.find(sound => sound.value === soundId);
      if (!soundToRemove) return;

      // Demander confirmation avant suppression
      const confirmDelete = window.confirm(
        `Êtes-vous sûr de vouloir supprimer le son "${soundToRemove.label.replace('🎵 ', '')}" ?\n\nCette action est irréversible.`
      );
      
      if (!confirmDelete) {
        return; 
      }

      // Supprimer le fichier audio du système de fichiers
      if (soundToRemove.file) {
        try {
          await Filesystem.deleteFile({
            path: soundToRemove.file,
            directory: Directory.Data,
          });
        } catch (error) {
          console.warn('Impossible de supprimer le fichier audio:', error);
        }
      }

      // Mettre à jour la liste des sons personnalisés
      const updatedCustomSounds = customSounds.filter(sound => sound.value !== soundId);
      setCustomSounds(updatedCustomSounds);
      
      // Sauvegarder dans le stockage persistant
      await saveCustomSounds(updatedCustomSounds);

      // Si le son supprimé était sélectionné, revenir au silence
      if (selectedSound === soundId) {
        setSelectedSound('silence');
      }

      console.log(`Son supprimé : ${soundToRemove.label}`);
    } catch (error) {
      console.error('Erreur lors de la suppression du son personnalisé :', error);
    }
  };

  const allSounds = [...soundOptions, ...customSounds];
  const selectedSoundOption = allSounds.find((s) => s.value === selectedSound);
  const selectedGongOption = gongOptions.find((g) => g.id === selectedGong);

  /* -------------------------
    Prévisualisation des sons avec lecture automatique
  -------------------------- */

  // Prévisualisation automatique du son ambiant lors du changement (sans le volume dans les dépendances)
  useEffect(() => {
    // Ne pas prévisualiser si on est en train de méditer
    if (isPlaying || isPaused) return;
    
    // Arrêter toute prévisualisation en cours
    if (previewAmbientRef.current) {
      previewAmbientRef.current.pause();
      previewAmbientRef.current = null;
    }

    // Nettoyer l'ancien timeout
    if (previewAmbientTimeoutRef.current) {
      clearTimeout(previewAmbientTimeoutRef.current);
      previewAmbientTimeoutRef.current = null;
    }

    // Trouver le fichier du son sélectionné
    const soundOption = allSounds.find(s => s.value === selectedSound);
    
    // Ne pas prévisualiser le silence
    if (selectedSound === 'silence' || !soundOption?.file) return;

    // Créer et jouer le nouveau son en prévisualisation
    const audio = new Audio(soundOption.file);
    audio.volume = volume;
    audio.loop = false;
    previewAmbientRef.current = audio;
    
    audio.play().catch(err => {
      console.error('Erreur lors de la lecture de la prévisualisation:', err);
    });

    // Arrêter la prévisualisation après 3 secondes
    previewAmbientTimeoutRef.current = setTimeout(() => {
      if (previewAmbientRef.current) {
        previewAmbientRef.current.pause();
        previewAmbientRef.current = null;
      }
    }, 5000);

    // Cleanup
    return () => {
      if (previewAmbientTimeoutRef.current) {
        clearTimeout(previewAmbientTimeoutRef.current);
        previewAmbientTimeoutRef.current = null;
      }
      if (previewAmbientRef.current) {
        previewAmbientRef.current.pause();
        previewAmbientRef.current = null;
      }
    };
  }, [selectedSound, isPlaying, isPaused]); // Pas de 'volume' ni 'selectedSoundOption' dans les dépendances

  // Prévisualisation automatique du gong lors du changement (sans le volume dans les dépendances)
  useEffect(() => {
    // Ne pas prévisualiser si on est en train de méditer
    if (isPlaying || isPaused) return;
    
    // Arrêter toute prévisualisation en cours
    if (previewGongRef.current) {
      previewGongRef.current.pause();
      previewGongRef.current = null;
    }

    if (!selectedGongOption?.file) return;

    // Créer et jouer le nouveau gong en prévisualisation
    const audio = new Audio(selectedGongOption.file);
    audio.volume = gongVolume;
    previewGongRef.current = audio;
    
    audio.play().catch(err => {
      console.error('Erreur lors de la lecture de la prévisualisation du gong:', err);
    });

    // Cleanup
    return () => {
      if (previewGongRef.current) {
        previewGongRef.current.pause();
        previewGongRef.current = null;
      }
    };
  }, [selectedGong, isPlaying, isPaused]); // Pas de 'gongVolume' dans les dépendances

  // Ajustement du volume en temps réel pour la prévisualisation du son ambiant
  useEffect(() => {
    if (previewAmbientRef.current) {
      previewAmbientRef.current.volume = volume;
    }
  }, [volume]);

  // Ajustement du volume en temps réel pour la prévisualisation du gong
  useEffect(() => {
    if (previewGongRef.current) {
      previewGongRef.current.volume = gongVolume;
    }
  }, [gongVolume]);

  /* -------------------------
    Logique du timer
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
    // Arrêter toutes les prévisualisations
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
    setPreparationTime(3);

    let countdown = 3;
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
    setNextGongIn(gongInterval > 0 ? gongInterval * 60 : 0);

    if (gongMoments.start) {
      playGong();
    }

    if (selectedSound !== 'silence' && ambientAudioRef.current) {
      ambientAudioRef.current.volume = volume;
      ambientAudioRef.current.play();
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

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

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

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
    Gestion de la durée personnalisée
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
    Interface utilisateur (UI)
  -------------------------- */

  return (
    <div className="app">
      <div className="container">

        {/* Logo uniquement */}
        <div style={{ textAlign: 'center' }}>
          <img src="/mediteasy.svg" alt="logo Mediteasy" style={{ height: '190px', width: 'auto' }} /> 
        </div>


        {/* Fichiers audio cachés */}
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

        {/* Phase de préparation */}
        {isPreparing && (
          <div className="section">
            <div className="time-display">{preparationTime}</div>
            <div className="text-muted">🧘 Préparez-vous...</div>
          </div>
        )}

        {/* Affichage pendant la méditation ou en pause */}
        {(isPlaying || isPaused) && (
          <div className="section">
            <div className="time-display">{formatTime(timeRemaining)}</div>
            <div className="text-muted">
              {isPaused ? '⏸️ En pause' : 'Temps restant'}
            </div>
            {gongInterval > 0 && nextGongIn > 0 && !isPaused && (
              <div className="text-muted">
                🔔 Prochain gong dans {formatTime(nextGongIn)}
              </div>
            )}
          </div>
        )}

        {/* Configuration avant démarrage */}
        {!isPlaying && !isPaused && !isFinished && !isPreparing && (
          <>
            {/* Son ambiant */}
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
                  <option value="custom">⬇️ Ajouter un son personnalisé</option>
                </select>
                {selectedSoundOption?.isCustom && (
                  <button 
                    onClick={() => removeCustomSound(selectedSound)} 
                    className="btn-delete"
                    title="Supprimer ce son"
                  >
                    <img src="/assets/images/trash.svg" alt="Supprimer" />
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

            {/* Gong de méditation */}
            <div className="section compact">
              <div className="control-row">
                <span className="control-icon">🔔</span>
                <select
                  value={selectedGong}
                  onChange={(e) => setSelectedGong(e.target.value)}
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
                  🔔 Début
                </label>
                <label className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={gongMoments.end}
                    onChange={(e) =>
                      setGongMoments({ ...gongMoments, end: e.target.checked })
                    }
                  />
                  🔔 Fin
                </label>
              </div>
            </div>

            {/* Durée de méditation */}
            <div className="section compact">
              <div className="control-row">
                <span className="control-icon">⏳</span>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="select compact"
                >
                  {durationOptions.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="btn btn-secondary compact"
                >
                  ➕ Personnaliser
                </button>
              ) : (
                <div className="custom-duration">
                  <input
                    type="number"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="1-180"
                    min="1"
                    max="180"
                    className="input compact"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleAddCustomDuration();
                    }}
                  />
                  <button onClick={handleAddCustomDuration} className="btn btn-primary compact">
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomMinutes('');
                    }}
                    className="btn btn-secondary compact"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Boutons Démarrer / Pause / Reprendre / Stop */}
        <div className="section">
          {!isPlaying && !isPaused && !isPreparing && (
            <button onClick={handlePlay} className="btn btn-primary">
              {isFinished ? '🔄 Recommencer' : '▶️ Démarrer'}
            </button>
          )}
          {isPaused && (
            <button onClick={handleResume} className="btn btn-primary">
              ▶️ Reprendre
            </button>
          )}
          {isPlaying && (
            <>
              <button onClick={handlePause} className="btn btn-secondary">
                ⏸️ Pause
              </button>
              <button onClick={handleStop} className="btn btn-secondary">
                ⏹️ Arrêter
              </button>
            </>
          )}
          {isPaused && (
            <button onClick={handleStop} className="btn btn-secondary">
              ⏹️ Arrêter
            </button>
          )}
        </div>

        {/* Fin de session */}
        {isFinished && (
          <div className="section">
            <div className="emoji">✨</div>
            <div className="title-section">Méditation terminée !</div>
          </div>
        )}
      </div>
    </div>
  );
}