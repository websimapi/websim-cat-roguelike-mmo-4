import { playSound } from './assets.js';

export function interactWithNPC(npcType, onClose) {
    const chatBox = document.getElementById('chat-box');
    const npcText = document.getElementById('npc-text');
    const npcName = document.getElementById('npc-name');

    chatBox.style.display = 'block';
    npcName.innerText = "Shopkeeper Cat";

    // Simple "Meow" dialogue as requested
    const phrases = [
        "Meow.",
        "Mrrrp... Meow?",
        "Prrrt! Meow meow.",
        "Meow... (The shop is closed)."
    ];
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    
    npcText.innerText = randomPhrase + "\n\n(Click to leave)";

    // Play Meow SFX
    playSound('meow', 0.8);

    // Click to exit handler
    // setTimeout ensures the click that opened this doesn't immediately close it
    setTimeout(() => {
        const handleClose = () => {
            chatBox.style.display = 'none';
            document.removeEventListener('click', handleClose);
            document.removeEventListener('keydown', handleKeyDown);
            if (onClose) onClose();
        };

        const handleKeyDown = (e) => {
            if (['Space', 'Enter', 'Escape'].includes(e.code)) {
                handleClose();
            }
        };

        document.addEventListener('click', handleClose);
        document.addEventListener('keydown', handleKeyDown);
    }, 200);
}

export function closeChat() {
    document.getElementById('chat-box').style.display = 'none';
}