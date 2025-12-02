export const ASSETS = {
    floor: new Image(),
    wall: new Image(),
    shop: new Image(),
    shootInfo: { url: 'shoot_sfx.mp3', buffer: null },
    meowInfo: { url: 'meow.mp3', buffer: null },
    musicInfo: { url: 'twilight_alley.ogg', buffer: null },
    loaded: false
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export async function loadAssets() {
    const promises = [
        new Promise(resolve => { ASSETS.floor.onload = resolve; ASSETS.floor.src = 'terrain_floor.png'; }),
        new Promise(resolve => { ASSETS.wall.onload = resolve; ASSETS.wall.src = 'terrain_wall.png'; }),
        new Promise(resolve => { ASSETS.shop.onload = resolve; ASSETS.shop.src = 'shop_front.png'; }),
        loadAudio(ASSETS.shootInfo),
        loadAudio(ASSETS.meowInfo),
        loadAudio(ASSETS.musicInfo)
    ];

    await Promise.all(promises);
    ASSETS.loaded = true;
}

async function loadAudio(audioObj) {
    try {
        const response = await fetch(audioObj.url);
        const arrayBuffer = await response.arrayBuffer();
        audioObj.buffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error("Failed to load audio", e);
    }
}

export function playSound(name, volume = 0.5) {
    let buffer = null;
    if (name === 'shoot') buffer = ASSETS.shootInfo.buffer;
    if (name === 'meow') buffer = ASSETS.meowInfo.buffer;

    if (buffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = volume;
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start(0);
    }
}

export function playTTS(url) {
    const audio = new Audio(url);
    audio.play();
}

let musicStarted = false;

export function startMusic() {
    if (musicStarted) return;
    musicStarted = true;
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (ASSETS.loaded) {
        playMusicLoop();
    } else {
        const check = setInterval(() => {
            if (ASSETS.loaded) {
                clearInterval(check);
                playMusicLoop();
            }
        }, 100);
    }
}

function playMusicLoop() {
    if (!ASSETS.musicInfo.buffer) return;
    
    const source = audioCtx.createBufferSource();
    source.buffer = ASSETS.musicInfo.buffer;
    
    const gainNode = audioCtx.createGain();
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    // Fade In: 0 to 1 over 15s
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + 15);
    
    // Fade Out: 1 to 0 from 120s to 135s
    gainNode.gain.setValueAtTime(1, now + 120);
    gainNode.gain.linearRampToValueAtTime(0, now + 135);
    
    source.start(now);
    source.stop(now + 135);
    
    source.onended = () => {
        setTimeout(playMusicLoop, 2000);
    };
}