import { useState, useRef, useEffect } from 'react';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
  { value: 'rain', label: '🌧️ Ocean', file: '/assets/ambients/ocean.mp3' },
];

const gongOptions = [
  { id: 'gong1', name: 'Gong Tibétain', file: '/assets/gongs/gong_hit.wav' },
  { id: 'gong2', name: 'Gong Chinois', file: '/assets/gongs/roger_gong.mp3' },
  { id: 'gong3', name: 'Gong Japonais', file: '/assets/gongs/studio_gong.wav' },
  { id: 'gong4', name: 'Gong Zen', file: '/assets/gongs/zen_gong.wav' },
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
    États de l’application
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

  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const gongAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gongTimerRef = useRef<NodeJS.Timeout | null>(null);
  const remainingTimeRef = useRef<number>(0);
  const nextGongTimeRef = useRef<number>(0);

  /* -------------------------
    Sélections actuelles
  -------------------------- */

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
      const result = await FilePicker.pickFiles({
        types: ['audio/*'],
        readData: true,
      });

      if (!result.files[0]) {
        console.log('Aucun fichier sélectionné');
        return;
      }

      const file = result.files[0];
      const soundId = `custom_${Date.now()}`;
      const fileName = `${soundId}.${file.name.split('.').pop()}`;

      // Sauvegarder le fichier dans le système de fichiers
      await Filesystem.writeFile({
        path: `audio/${fileName}`,
        data: file.data ?? '',
        directory: Directory.Data,
      });

      const newSound: SoundOption = {
        value: soundId,
        label: `🎵 ${file.name.split('.')[0]}`,
        file: `audio/${fileName}`,
        isCustom: true,
      };

      const updatedSounds = [...customSounds, newSound];
      setCustomSounds(updatedSounds);
      saveCustomSounds(updatedSounds);
    } catch (error) {
      console.error('Erreur lors de la sélection ou de la sauvegarde du fichier :', error);
    }
  };

  const allSounds = [...soundOptions, ...customSounds];
  const selectedSoundOption = allSounds.find((s) => s.value === selectedSound);
  const selectedGongOption = gongOptions.find((g) => g.id === selectedGong);

  /* -------------------------
    Effets pour ajuster les volumes
  -------------------------- */

  useEffect(() => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (gongAudioRef.current) {
      gongAudioRef.current.volume = gongVolume;
    }
  }, [gongVolume]);

  /* -------------------------
    Fonction pour jouer le gong
  -------------------------- */

  const playGong = () => {
    if (gongAudioRef.current) {
      gongAudioRef.current.currentTime = 0;
      gongAudioRef.current.play().catch((err) => console.error('Erreur gong:', err));
    }
  };

  /* -------------------------
    Formatage du temps
  -------------------------- */

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /* -------------------------
    Lancer la méditation
  -------------------------- */

  const handlePlay = () => {
    setIsPlaying(true);
    setIsFinished(false);
    const totalSeconds = duration * 60;
    setTimeRemaining(totalSeconds);
    setNextGongIn(gongInterval > 0 ? gongInterval * 60 : 0);

    // Gong de début (si activé)
    if (gongMoments.start) {
      setTimeout(() => playGong(), 500);
    }

    // Lecture du son ambiant
    if (selectedSound !== 'silence' && ambientAudioRef.current) {
      ambientAudioRef.current.currentTime = 0;
      ambientAudioRef.current.volume = volume;
      ambientAudioRef.current.play().catch((err) => console.error('Erreur audio:', err));
    }

    // Timer principal (compte à rebours)
    let remaining = totalSeconds;
    timerRef.current = setInterval(() => {
      remaining--;
      setTimeRemaining(remaining);
      

      // Fin du timer
      if (remaining <= 0) {
        handleStop();
        setIsFinished(true);
        // Gong de fin si activé
        if (gongMoments.end) {
          playGong();
        }
      }
    }, 1000);

    // Timer des gongs (intervalles réguliers)
    if (gongInterval > 0) {
      let nextGong = gongInterval * 60;
      setNextGongIn(nextGong);
      
      gongTimerRef.current = setInterval(() => {
        nextGong--;
        setNextGongIn(nextGong);
        
        if (nextGong <= 0 && remaining > 0) {
          playGong();
          nextGong = gongInterval * 60;
          setNextGongIn(nextGong);
        }
      }, 1000);
    }
  };

  /* -------------------------
    Pause de la méditation
  -------------------------- */

  const handlePause = () => {
    setIsPlaying(false);
    if (ambientAudioRef.current) {
      ambientAudioRef.current.pause();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (gongTimerRef.current) {
      clearInterval(gongTimerRef.current);
    }
  };

  /* -------------------------
    Arrêt de la méditation
  -------------------------- */

  const handleStop = () => {
    setIsPlaying(false);
    if (ambientAudioRef.current) {
      ambientAudioRef.current.pause();
      ambientAudioRef.current.currentTime = 0;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (gongTimerRef.current) {
      clearInterval(gongTimerRef.current);
    }
    setTimeRemaining(0);
    setNextGongIn(0);
  };

    /* -------------------------
    Gestion de la durée personnalisé
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
    Test son du gong
  -------------------------- */

  const handleTestGong = () => {
    if (gongAudioRef.current) {
      gongAudioRef.current.currentTime = 0;
      gongAudioRef.current.play().catch((err) => console.error('Erreur test gong:', err));
    }
  };

    /* -------------------------
    Interface utilisateur (UI)
  -------------------------- */

  return (
    <div className="">
      <div className="">

        {/* Titre principal */}
        <h1 className="">
          🧘 Méditation Timer
        </h1>

        {/* Section pour les sons personnalisés */}
        <div className="mb-6 p-6 bg-yellow-50 rounded-xl">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">
            Sons personnalisés
          </h2>
          <button
            onClick={addCustomSound}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition-colors mb-4"
          >
            ➕ Ajouter un son personnalisé
          </button>

          {customSounds.length > 0 ? (
            <ul className="space-y-2">
              {customSounds.map((sound) => (
                <li
                  key={sound.value}
                  className="flex items-center justify-between p-3 bg-yellow-100 rounded-lg"
                >
                  <span>{sound.label}</span>
                  <button
                    onClick={() => setSelectedSound(sound.value)}
                    className="text-yellow-800 hover:text-yellow-900 font-medium"
                  >
                    🎵 Sélectionner
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-yellow-800">Aucun son personnalisé ajouté.</p>
          )}
        </div>

        {/* Section pour les sons personnalisés */}
        <div className="mb-6 p-6 bg-yellow-50 rounded-xl">
          <h2 className="text-xl font-semibold text-yellow-900 mb-4">
            Sons personnalisés
          </h2>
          <button
            onClick={addCustomSound}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition-colors mb-4"
          >
            ➕ Ajouter un son personnalisé
          </button>

          {customSounds.length > 0 ? (
            <ul className="space-y-2">
              {customSounds.map((sound) => (
                <li
                  key={sound.value}
                  className="flex items-center justify-between p-3 bg-yellow-100 rounded-lg"
                >
                  <span>{sound.label}</span>
                  <button
                    onClick={() => setSelectedSound(sound.value)}
                    className="text-yellow-800 hover:text-yellow-900 font-medium"
                  >
                    🎵 Sélectionner
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-yellow-800">Aucun son personnalisé ajouté.</p>
          )}
        </div>

        {/* Fichiers audio cachés (préchargés) */}
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

        {/* Affichage du temps pendant la méditation */}
        {isPlaying && (
          <div className="">
            <div className="">{formatTime(timeRemaining)}</div>
            <div className="">Temps restant</div>
            {gongInterval > 0 && nextGongIn > 0 && (
              <div className="">
                🔔 Prochain gong dans {formatTime(nextGongIn)}
              </div>
            )}
          </div>
        )}

        {/* Configuration avant démarrage */}
        {!isPlaying && !isFinished && (
          <>
            {/* Section : Son ambiant */}
            <div className="">
              <h2 className="">
                Son ambiant
              </h2>
              <select
                value={selectedSound}
                onChange={(e) => setSelectedSound(e.target.value)}
                className=""
              >
                {allSounds.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              
              {/* Curseur volume */}
              {selectedSound !== 'silence' && (
                <div>
                  <label className="">
                    Volume ambiant: {Math.round(volume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className=""
                  />
                </div>
              )}
            </div>

            {/* Section : Gong de méditation */}
            <div className="">
              <h2 className="">
                Gong de méditation
              </h2>

              {/* Choix du type de gong */}
              <div className="">
                <label className="">
                  Type de gong
                </label>
                <select
                  value={selectedGong}
                  onChange={(e) => setSelectedGong(e.target.value)}
                  className=""
                >
                  {gongOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Volume du gong */}
              <div className="">
                <label className="">
                  Volume du gong: {Math.round(gongVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={gongVolume}
                  onChange={(e) => setGongVolume(parseFloat(e.target.value))}
                  className=""
                />
              </div>

              {/* Fréquence et moments des gongs */}
              <div className="">
                <label className="">
                  Fréquence des gongs
                </label>
                <select
                  value={gongInterval}
                  onChange={(e) => setGongInterval(parseInt(e.target.value))}
                  className=""
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gongs au début / fin */}
              <div className="">
                <label className="">
                  Gong aux moments clés
                </label>
                <label className="">
                  <input
                    type="checkbox"
                    checked={gongMoments.start}
                    onChange={(e) => setGongMoments({ ...gongMoments, start: e.target.checked })}
                    className=""
                  />
                  <span className="">🔔 Au début de la session</span>
                </label>
                <label className="">
                  <input
                    type="checkbox"
                    checked={gongMoments.end}
                    onChange={(e) => setGongMoments({ ...gongMoments, end: e.target.checked })}
                    className=""
                  />
                  <span className="">🔔 À la fin de la session</span>
                </label>
              </div>

              {/* Bouton de test */}
              <button
                onClick={handleTestGong}
                className=""
              >
                🔊 Tester le gong
              </button>
            </div>

            {/* Section : Durée de méditation */}
            <div className="">
              <h2 className="">
                Durée de méditation
              </h2>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className=""
              >
                {durationOptions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>

              {/* Option durée personnalisée */}
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className=""
                >
                  ➕ Durée personnalisée
                </button>
              ) : (
                <div className="">
                  <input
                    type="number"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="1-180 min"
                    min="1"
                    max="180"
                    className=""
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleAddCustomDuration();
                    }}
                  />
                  <button
                    onClick={handleAddCustomDuration}
                    className=""
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomMinutes('');
                    }}
                    className=""
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Boutons d’action : Démarrer / Pause / Stop */}
        <div className="">
          {!isPlaying && (
            <button
              onClick={handlePlay}
              className=""
            >
              {isFinished ? '🔄 Recommencer' : '▶️ Démarrer'}
            </button>
          )}

          {isPlaying && (
            <>
              <button
                onClick={handlePause}
                className=""
              >
                ⏸️ Pause
              </button>
              <button
                onClick={handleStop}
                className=""
              >
                ⏹️ Arrêter
              </button>
            </>
          )}
        </div>

        {/* Message de fin de session */}
        {isFinished && (
          <div className="">
            <div className="">✨</div>
            <div className="">
              Méditation terminée !
            </div>
          </div>
        )}
      </div>
    </div>
  );
}