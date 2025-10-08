import { useState, useRef, useEffect } from 'react';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface SoundOption {
  value: string;
  label: string;
  file?: string;
  isCustom?: boolean;
}

const soundOptions: SoundOption[] = [
  { value: 'silence', label: '🔇 Silence' },
  { value: 'rain', label: '🌧️ Pluie', file: '/assets/ambient/rain.mp3' },
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

export default function MeditationTimer() {
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

  const playGong = () => {
    if (gongAudioRef.current) {
      gongAudioRef.current.currentTime = 0;
      gongAudioRef.current.play().catch((err) => console.error('Erreur gong:', err));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setIsFinished(false);
    const totalSeconds = duration * 60;
    setTimeRemaining(totalSeconds);
    setNextGongIn(gongInterval > 0 ? gongInterval * 60 : 0);

    if (gongMoments.start) {
      setTimeout(() => playGong(), 500);
    }

    if (selectedSound !== 'silence' && ambientAudioRef.current) {
      ambientAudioRef.current.currentTime = 0;
      ambientAudioRef.current.volume = volume;
      ambientAudioRef.current.play().catch((err) => console.error('Erreur audio:', err));
    }

    let remaining = totalSeconds;
    timerRef.current = setInterval(() => {
      remaining--;
      setTimeRemaining(remaining);
      
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

  const handleAddCustomDuration = () => {
    const minutes = parseInt(customMinutes, 10);
    if (!isNaN(minutes) && minutes >= 1 && minutes <= 180) {
      setDuration(minutes);
      setShowCustomInput(false);
      setCustomMinutes('');
    }
  };

  const handleTestGong = () => {
    if (gongAudioRef.current) {
      gongAudioRef.current.currentTime = 0;
      gongAudioRef.current.play().catch((err) => console.error('Erreur test gong:', err));
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-4xl font-bold text-center text-indigo-900 mb-8">
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

        {isPlaying && (
          <div className="mb-8 text-center bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl p-6">
            <div className="text-6xl font-bold mb-2">{formatTime(timeRemaining)}</div>
            <div className="text-lg opacity-90">Temps restant</div>
            {gongInterval > 0 && nextGongIn > 0 && (
              <div className="mt-4 text-sm opacity-80">
                🔔 Prochain gong dans {formatTime(nextGongIn)}
              </div>
            )}
          </div>
        )}

        {!isPlaying && !isFinished && (
          <>
            <div className="mb-6 p-6 bg-indigo-50 rounded-xl">
              <h2 className="text-xl font-semibold text-indigo-900 mb-4">
                Son ambiant
              </h2>
              <select
                value={selectedSound}
                onChange={(e) => setSelectedSound(e.target.value)}
                className="w-full p-3 border-2 border-indigo-200 rounded-lg focus:border-indigo-500 focus:outline-none mb-4"
              >
                {allSounds.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {selectedSound !== 'silence' && (
                <div>
                  <label className="block text-sm font-medium text-indigo-800 mb-2">
                    Volume ambiant: {Math.round(volume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div className="mb-6 p-6 bg-purple-50 rounded-xl">
              <h2 className="text-xl font-semibold text-purple-900 mb-4">
                Gong de méditation
              </h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-800 mb-2">
                  Type de gong
                </label>
                <select
                  value={selectedGong}
                  onChange={(e) => setSelectedGong(e.target.value)}
                  className="w-full p-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none"
                >
                  {gongOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-800 mb-2">
                  Volume du gong: {Math.round(gongVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={gongVolume}
                  onChange={(e) => setGongVolume(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-800 mb-2">
                  Fréquence des gongs
                </label>
                <select
                  value={gongInterval}
                  onChange={(e) => setGongInterval(parseInt(e.target.value))}
                  className="w-full p-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none"
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4 space-y-2">
                <label className="block text-sm font-medium text-purple-800 mb-2">
                  Gong aux moments clés
                </label>
                <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-purple-100 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={gongMoments.start}
                    onChange={(e) => setGongMoments({ ...gongMoments, start: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-purple-900">🔔 Au début de la session</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-purple-100 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    checked={gongMoments.end}
                    onChange={(e) => setGongMoments({ ...gongMoments, end: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-purple-900">🔔 À la fin de la session</span>
                </label>
              </div>

              <button
                onClick={handleTestGong}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                🔊 Tester le gong
              </button>
            </div>

            <div className="mb-6 p-6 bg-pink-50 rounded-xl">
              <h2 className="text-xl font-semibold text-pink-900 mb-4">
                Durée de méditation
              </h2>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full p-3 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none mb-4"
              >
                {durationOptions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>

              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="w-full bg-pink-100 hover:bg-pink-200 text-pink-800 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  ➕ Durée personnalisée
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="1-180 min"
                    min="1"
                    max="180"
                    className="flex-1 p-3 border-2 border-pink-200 rounded-lg focus:border-pink-500 focus:outline-none"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleAddCustomDuration();
                    }}
                  />
                  <button
                    onClick={handleAddCustomDuration}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 rounded-lg"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomMinutes('');
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-4 justify-center">
          {!isPlaying && (
            <button
              onClick={handlePlay}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              {isFinished ? '🔄 Recommencer' : '▶️ Démarrer'}
            </button>
          )}

          {isPlaying && (
            <>
              <button
                onClick={handlePause}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
              >
                ⏸️ Pause
              </button>
              <button
                onClick={handleStop}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
              >
                ⏹️ Arrêter
              </button>
            </>
          )}
        </div>

        {isFinished && (
          <div className="mt-6 text-center p-6 bg-green-100 rounded-xl">
            <div className="text-3xl mb-2">✨</div>
            <div className="text-xl font-semibold text-green-800">
              Méditation terminée !
            </div>
          </div>
        )}
      </div>
    </div>
  );
}