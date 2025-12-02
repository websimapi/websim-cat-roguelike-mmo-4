import nipplejs from 'https://esm.sh/nipplejs';
import { startMusic } from './assets.js';

export const Input = {
    keys: {},
    mouse: { x: 0, y: 0, leftDown: false, moved: false },
    joystickVector: { x: 0, y: 0 },
    active: true,

    init(canvas) {
        const focusOverlay = document.getElementById('focus-overlay');

        // LONG TAP LOGIC
        let touchTimer = null;
        let touchStartPos = { x: 0, y: 0 };
        const LONG_PRESS_MS = 600;

        const startSession = () => {
            startMusic();
            document.getElementById('loading').style.display = 'none';

            // Removed fullscreen/orientation lock and close button logic
            // Mobile still uses CSS-based forced landscape via index.html media query

            window.removeEventListener('keydown', startSession);
            window.removeEventListener('mousemove', startSession);
            window.removeEventListener('touchstart', startSession);
        };

        // Ensure the canvas can receive keyboard focus and grabs it when clicked
        canvas.setAttribute('tabindex', '0');
        canvas.addEventListener('click', () => {
            canvas.focus();
        });

        // Simple desktop vs touch detection (used to gate mouse-region overlay logic)
        const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        // Reset input state when the window loses focus so no keys get "stuck"
        window.addEventListener('blur', () => {
            this.keys = {};
            this.joystickVector.x = 0;
            this.joystickVector.y = 0;
            this.mouse.leftDown = false;
            if (focusOverlay) focusOverlay.style.display = 'block';
        });

        window.addEventListener('focus', () => {
            if (focusOverlay) focusOverlay.style.display = 'none';
        });

        // Desktop-only: show grey overlay when mouse leaves the game canvas region
        if (!isTouchDevice && focusOverlay) {
            canvas.addEventListener('mouseenter', () => {
                // Only hide overlay if window/tab itself has focus
                if (document.hasFocus()) {
                    focusOverlay.style.display = 'none';
                }
            });

            canvas.addEventListener('mouseleave', () => {
                // Only show overlay if the window still has focus (true "out of game region")
                if (document.hasFocus()) {
                    focusOverlay.style.display = 'block';
                }
            });
        }

        window.addEventListener('keydown', startSession);
        window.addEventListener('mousemove', startSession);
        window.addEventListener('touchstart', startSession);

        window.addEventListener('keydown', (e) => {
            if (!this.active) return;
            this.keys[e.code] = true;
            this.keys[e.key.toLowerCase()] = true;
            if (e.code === 'Space') e.preventDefault();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.keys[e.key.toLowerCase()] = false;
        });

        // Helper to handle coordinate mapping when forced-landscape is active
        const getMappedCoordinates = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect();
            
            // Check if we are in CSS-forced portrait mode (Phone only)
            // Must match the CSS media query condition: portrait AND width < 760px
            const isPhonePortrait = window.innerHeight > window.innerWidth && window.innerWidth < 760;
            
            if (isPhonePortrait) {
                // If rotated 90deg clockwise:
                // We map screen coordinates to the local canvas coordinates.
                // Center-relative approach:
                const cx = window.innerWidth / 2;
                const cy = window.innerHeight / 2;
                
                // Vector from screen center
                const dx = clientX - cx;
                const dy = clientY - cy;
                
                // Rotate vector -90deg (Counter Clockwise) to undo the CSS rotation
                // x' = y
                // y' = -x
                const localDx = dy;
                const localDy = -dx;
                
                // Add back the canvas center
                const canvasCx = canvas.width / 2;
                const canvasCy = canvas.height / 2;
                
                return {
                    x: canvasCx + localDx,
                    y: canvasCy + localDy
                };
            } else {
                // Standard Landscape
                return {
                    x: clientX - rect.left,
                    y: clientY - rect.top
                };
            }
        };

        canvas.addEventListener('mousemove', (e) => {
            const pos = getMappedCoordinates(e.clientX, e.clientY);
            this.mouse.x = pos.x;
            this.mouse.y = pos.y;
            this.mouse.moved = true;
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.leftDown = false;
        });

        // Prevent context menu on right click
        canvas.addEventListener('contextmenu', e => {
            // We prevent default but we allow our game logic to handle it in game.js via a synthetic check or event
            // But game.js attaches its own listener to 'contextmenu'. 
            // We just ensure we don't block propagation to that listener if we put one here.
            // Actually, we'll let game.js handle the UI popup.
            e.preventDefault(); 
        });

        // Desktop mouse shoot (left click)
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                e.preventDefault();
                const pos = getMappedCoordinates(e.clientX, e.clientY);
                this.mouse.x = pos.x;
                this.mouse.y = pos.y;
                this.mouse.moved = true;
                this.mouse.leftDown = true;
            }
        });

        // --- MOBILE CONTROLS ---

        // 1. Joystick (Movement)
        const joystickZone = document.getElementById('joystick-zone');
        if (joystickZone) {
            const manager = nipplejs.create({
                zone: joystickZone,
                mode: 'static',
                position: { left: '50%', top: '50%' },
                color: 'rgba(255, 255, 255, 0.8)',
                size: 80
            });

            manager.on('move', (evt, data) => {
                if (data.vector) {
                    const vX = data.vector.x;
                    const vY = data.vector.y;

                    // Adjust joystick axes when the game is rotated into landscape while the device is in portrait
                    // Same condition: Phone only
                    const isPhonePortrait = window.innerHeight > window.innerWidth && window.innerWidth < 760;

                    if (isPhonePortrait) {
                        // Undo the 90deg clockwise rotation applied to the game container,
                        // and flip horizontal so left/right feel correct.
                        this.joystickVector.x = -vY;
                        this.joystickVector.y = -vX;
                    } else {
                        // Normal landscape: standard mapping
                        this.joystickVector.x = vX;
                        this.joystickVector.y = -vY; // Invert Y for screen coordinates
                    }
                }
            });

            manager.on('end', () => {
                this.joystickVector.x = 0;
                this.joystickVector.y = 0;
            });
        }

        // 2. Touch Aim & Shoot (Canvas)
        const handleTouchStart = (e) => {
            e.preventDefault(); 
            if (e.touches.length > 0) {
                const t = e.touches[e.touches.length - 1];
                const pos = getMappedCoordinates(t.clientX, t.clientY);
                
                this.mouse.x = pos.x;
                this.mouse.y = pos.y;
                this.mouse.moved = true;
                this.mouse.leftDown = true;

                // Start Long Tap Timer
                touchStartPos = { x: t.clientX, y: t.clientY };
                touchTimer = setTimeout(() => {
                    // Trigger Custom Context Menu Event
                    const event = new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: t.clientX,
                        clientY: t.clientY
                    });
                    canvas.dispatchEvent(event);
                    this.mouse.leftDown = false; // Cancel shot if it became a long tap
                }, LONG_PRESS_MS);
            }
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const t = e.touches[e.touches.length - 1];
                const pos = getMappedCoordinates(t.clientX, t.clientY);
                this.mouse.x = pos.x;
                this.mouse.y = pos.y;
                this.mouse.moved = true;
                this.mouse.leftDown = true;

                // Cancel Long Tap if moved too much
                if (touchTimer && Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y) > 10) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            }
        };

        const handleTouchEnd = (e) => {
            e.preventDefault();
            this.mouse.leftDown = false;
            if (touchTimer) {
                clearTimeout(touchTimer);
                touchTimer = null;
            }
        };

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);
    },

    getMovementVector() {
        let x = 0;
        let y = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
        
        // Apply Joystick
        if (this.joystickVector.x !== 0 || this.joystickVector.y !== 0) {
            x += this.joystickVector.x;
            y += this.joystickVector.y;
        }

        return { x, y };
    },

    isShooting() {
        return this.keys['Space'] || this.mouse.leftDown;
    }
};