import * as THREE from "three";

export const SOUND_ASSETS = Object.freeze({
  pickup: "/local-assets/cardinal/rf01/audio/rf01_battery_pickup.mp3",
  drop: "/local-assets/cardinal/rf01/audio/rf01_battery_drop.mp3",
  power: "/local-assets/cardinal/rf01/audio/rf01_power_module_insert_and_startup.mp3",
});

const EVENT_SOUNDS = Object.freeze({
  battery_collected: "pickup",
  battery_dropped: "drop",
  power_restored: "power",
});

const SOUND_VOLUME = Object.freeze({ pickup: 0.9, drop: 0.9, power: 1 });

export function soundKeyForEvent(eventName, eventSounds = EVENT_SOUNDS) {
  return eventSounds[eventName] ?? null;
}

export function createAudioSystem(camera, scene, options = {}) {
  const soundAssets = options.assets ?? SOUND_ASSETS;
  const eventSounds = options.eventSounds ?? EVENT_SOUNDS;
  const soundVolume = options.volume ?? SOUND_VOLUME;
  const listener = new THREE.AudioListener();
  const loader = new THREE.AudioLoader();
  const buffers = new Map();
  const pending = new Map();
  const active = new Set();
  camera.add(listener);

  Object.entries(soundAssets).forEach(([key, url]) => {
    pending.set(key, new Promise((resolve) => {
      loader.load(
        url,
        (buffer) => {
          buffers.set(key, buffer);
          resolve(true);
        },
        undefined,
        () => resolve(false),
      );
    }));
  });

  function unlock() {
    if (listener.context.state === "suspended") return listener.context.resume();
    return Promise.resolve();
  }

  function play(key, position) {
    const buffer = buffers.get(key);
    if (!buffer) return false;
    const sound = new THREE.PositionalAudio(listener);
    sound.setBuffer(buffer);
    // The listener sits on the fixed overhead camera, so use a broad falloff
    // while retaining left/right spatial placement across the facility.
    sound.setRefDistance(16);
    sound.setMaxDistance(80);
    sound.setRolloffFactor(0.45);
    sound.setVolume(soundVolume[key] ?? 0.9);
    sound.position.set(position.x, position.y ?? 0.8, position.z);
    const baseOnEnded = sound.onEnded.bind(sound);
    sound.onEnded = () => {
      baseOnEnded();
      active.delete(sound);
      scene.remove(sound);
      sound.disconnect();
    };
    scene.add(sound);
    active.add(sound);
    sound.play();
    return true;
  }

  function playEvent(eventName, position) {
    const key = soundKeyForEvent(eventName, eventSounds);
    if (!key) return false;
    void unlock();
    if (play(key, position)) return true;
    void pending.get(key)?.then((loaded) => {
      if (loaded) play(key, position);
    });
    return true;
  }

  function stopAll() {
    active.forEach((sound) => {
      if (sound.isPlaying) sound.stop();
    });
  }

  return { unlock, playEvent, stopAll };
}
