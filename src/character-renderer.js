import { CONFIG } from './config.js';

export function drawCharacter(ctx, entity, x, y, size, isNpc) {
    let cx = x + size / 2;
    let cy = y + size / 2;
    const scale = size / 32;

    ctx.save();

    let bob = 0;
    // Offsets for feet
    let fxL = 0, fyL = 0;
    let fxR = 0, fyR = 0;

    // 1. Hit Animation (High Priority)
    if (entity.hitAnim) {
        const now = Date.now();
        const elapsed = now - entity.hitAnim.startTime;
        if (elapsed < entity.hitAnim.duration) {
            const t = elapsed / entity.hitAnim.duration;
            // Ease out
            const power = (1 - t) * (1 - t);

            // Knockback offset
            const offX = entity.hitAnim.vx * power * size * 2;
            const offY = entity.hitAnim.vy * power * size * 2;

            // Apply translation
            ctx.translate(offX, offY);

            // Squash effect (Scale Y down, Scale X up)
            const squash = 1.0 - (Math.sin(t * Math.PI) * 0.3);
            const stretch = 1.0 + (Math.sin(t * Math.PI) * 0.1);

            // Scale around center
            ctx.translate(cx, cy);
            ctx.scale(stretch, squash);
            ctx.translate(-cx, -cy);

            // Exaggerated bob on hit
            bob = Math.sin(elapsed / 25) * 4 * scale;

            // Circular stumble (lift and place)
            const hRad = 5 * scale;
            fxL = Math.cos(elapsed / 50) * hRad;
            fyL = Math.sin(elapsed / 50) * hRad;
            fxR = Math.cos(elapsed / 50 + Math.PI) * hRad;
            fyR = Math.sin(elapsed / 50 + Math.PI) * hRad;
        } else {
            entity.hitAnim = null;
        }
    } 
    // 2. Walking Animation
    else if (entity.isMoving) {
        const speedFactor = 80; // Lower is faster animation
        const t = Date.now() / speedFactor;
        const stride = 7 * scale;
        const liftHeight = 6 * scale;

        // Bobbing: Dip down twice per cycle (when feet are spread)
        // sin^2 oscillates 0..1 twice per 0..2PI
        // We want to dip down (positive Y) at spread (Peaks of cos)
        bob = (Math.cos(t) * Math.cos(t)) * 2 * scale;

        if (entity.facing === 'up' || entity.facing === 'down') {
            // Vertical walking: Feet shuffle up/down
            const vStride = 5 * scale;
            fyL = Math.sin(t) * vStride;
            fyR = Math.sin(t + Math.PI) * vStride;
        } else {
            // Horizontal walking
            const dir = (entity.facing === 'left' ? -1 : 1);

            // Left Foot
            fxL = Math.cos(t) * stride * dir;
            fyL = (Math.sin(t) < 0) ? Math.sin(t) * liftHeight : 0;

            // Right Foot (Phase offset PI)
            fxR = Math.cos(t + Math.PI) * stride * dir;
            fyR = (Math.sin(t + Math.PI) < 0) ? Math.sin(t + Math.PI) * liftHeight : 0;
        }

    } 
    // 3. Idle Animation
    else {
            const time = Date.now() / 150;
            bob = Math.sin(time) * 1.5 * scale; // Gentle idle bob
    }

    // Per-entity blink parameters so they don't all blink in sync
    if (!entity._blink) {
        const base = (entity.id || (isNpc ? 'npc' : 'anon')) + (isNpc ? '_npc' : '_p');
        let hash = 0;
        for (let i = 0; i < base.length; i++) {
            hash = base.charCodeAt(i) + ((hash << 5) - hash);
        }
        const rng = (n) => {
            const x = Math.sin(hash + n) * 10000;
            return x - Math.floor(x);
        };
        entity._blink = {
            offset: rng(1) * 3.0,              // seconds offset into cycle
            interval: 2.5 + rng(2) * 1.8,      // 2.5–4.3s between blinks
            duration: 0.06 + rng(3) * 0.07     // 0.06–0.13s blink length
        };
    }

    // Simple blink timing: unique quick blink every few seconds
    const tSeconds = Date.now() / 1000;
    const phase = (tSeconds + entity._blink.offset) % entity._blink.interval;
    const isBlinking = phase < entity._blink.duration;

    // Compute gun cooldown progress (0 = just fired, 1 = ready)
    let cooldown = 1;
    if (!isNpc) {
        const lastShot = entity.lastShot || 0;
        const elapsed = tSeconds - lastShot;
        const rate = CONFIG.FIRE_RATE || 0.8;
        cooldown = Math.max(0, Math.min(1, elapsed / rate));
    }

    // Color based on hash of ID or Type
    let hue = 0;
    if (isNpc) {
        hue = 200; // Blueish for NPC
    } else {
        // Simple hash for color consistency
        let hash = 0;
        for (let i = 0; i < entity.id.length; i++) hash = entity.id.charCodeAt(i) + ((hash << 5) - hash);
        hue = Math.abs(hash) % 360;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    // Shadow stays on ground (no bob)
    ctx.ellipse(cx, cy + 12 * scale, 8 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawDetailedPaw = (x, y, r) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2);
        ctx.fill();
        // Toes
        const tr = r * 0.4; 
        ctx.beginPath();
        ctx.arc(x - r*0.6, y + r*0.5, tr, 0, Math.PI*2);
        ctx.arc(x,         y + r*0.7, tr, 0, Math.PI*2);
        ctx.arc(x + r*0.6, y + r*0.5, tr, 0, Math.PI*2);
        ctx.fill();
    };

    // Hand swing animation calculation
    let hxL = 0, hyL = 0;
    let hxR = 0, hyR = 0;

    if (entity.isMoving && !entity.hitAnim) {
        const t = Date.now() / 80;
        const swing = 8 * scale;

        if (entity.facing === 'up' || entity.facing === 'down') {
            // Vertical swing when moving up/down (pump forward/back)
            hyL = Math.cos(t) * swing;
            hyR = Math.cos(t + Math.PI) * swing;
        } else {
            // Horizontal swing when moving left/right
            hxL = Math.cos(t) * swing;
            hxR = Math.cos(t + Math.PI) * swing;
        }
    }

    // Feet (Floating) - Draw FIRST (Low Z-Index)
    ctx.fillStyle = `hsl(${hue}, 70%, 40%)`;

    // Apply calculated offsets (fx, fy are relative to neutral pos)
    // Left Foot
    drawDetailedPaw(cx - 5 * scale + fxL, cy + 4 * scale + fyL, 5 * scale);
    // Right Foot
    drawDetailedPaw(cx + 5 * scale + fxR, cy + 4 * scale + fyR, 5 * scale);

    // Right hand base position
    const handRX = cx + 9 * scale + hxR;
    const handRY = cy - 4 * scale + bob + hyR;

    // When facing up, draw hands (and gun) BEFORE head so they appear behind it
    if (entity.facing === 'up') {
        // Left Hand
        ctx.fillStyle = `hsl(${hue}, 70%, 80%)`;
        drawDetailedPaw(cx - 9 * scale + hxL, cy - 4 * scale + bob + hyL, 4 * scale);

        // Right Hand (Holds Gun)
        ctx.fillStyle = `hsl(${hue}, 70%, 80%)`;
        drawDetailedPaw(handRX, handRY, 4 * scale);

        // Gun
        if (!isNpc) drawGun(ctx, handRX, handRY, entity.aimAngle || 0, scale, cooldown);
    }

    // Body (Main Head/Torso) - Draw SECOND (Middle Z-Index)
    // Let's do a cute cat head as the main body
    const headY = cy - 13 * scale + bob; // Moved up

    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.beginPath();
    // Head shape
    ctx.ellipse(cx, headY, 10 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    // Left Ear
    ctx.moveTo(cx - 9 * scale, headY - 5 * scale);
    ctx.lineTo(cx - 6 * scale, headY - 14 * scale);
    ctx.lineTo(cx - 3 * scale, headY - 5 * scale);
    ctx.fill(); 

    // Right Ear
    ctx.beginPath();
    ctx.moveTo(cx + 3 * scale, headY - 5 * scale);
    ctx.lineTo(cx + 6 * scale, headY - 14 * scale);
    ctx.lineTo(cx + 9 * scale, headY - 5 * scale);
    ctx.fill();

    // Eyes + Blink
    if (entity.facing !== 'up') {
        // Whiskers
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1 * scale;
        const wY = headY + 2 * scale;

        // Left Whiskers
        ctx.beginPath();
        for(let i=0; i<3; i++) {
            ctx.moveTo(cx - 6 * scale, wY + (i*1.5 - 1.5) * scale);
            ctx.lineTo(cx - 9 * scale, wY + (i*3 - 3) * scale);
        }
        ctx.stroke();

        // Right Whiskers
        ctx.beginPath();
        for(let i=0; i<3; i++) {
            ctx.moveTo(cx + 6 * scale, wY + (i*1.5 - 1.5) * scale);
            ctx.lineTo(cx + 9 * scale, wY + (i*3 - 3) * scale);
        }
        ctx.stroke();

        if (!isBlinking) {
            // Normal open eyes
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(cx - 4 * scale, headY, 3 * scale, 0, Math.PI*2);
            ctx.arc(cx + 4 * scale, headY, 3 * scale, 0, Math.PI*2);
            ctx.fill(); 

            ctx.fillStyle = 'black';
            let pupilOffX = 0;
            if (entity.facing === 'left') pupilOffX = -1 * scale;
            if (entity.facing === 'right') pupilOffX = 1 * scale;

            ctx.beginPath();
            ctx.arc(cx - 4 * scale + pupilOffX, headY, 1 * scale, 0, Math.PI*2);
            ctx.arc(cx + 4 * scale + pupilOffX, headY, 1 * scale, 0, Math.PI*2);
            ctx.fill(); 
        } else {
            // Blinking: draw thin eyelid lines
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1.2 * scale;
            ctx.beginPath();
            ctx.moveTo(cx - 7 * scale, headY);
            ctx.lineTo(cx - 1 * scale, headY);
            ctx.moveTo(cx + 1 * scale, headY);
            ctx.lineTo(cx + 7 * scale, headY);
            ctx.stroke();
        }
    } else {
            // Facing Up (Back view) - Draw Tail
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.beginPath();
        const tailWag = entity.isMoving ? Math.sin(Date.now() / 100) * 6 * scale : Math.sin(Date.now() / 300) * 2 * scale;
        ctx.ellipse(cx + tailWag, headY + 9 * scale, 2.5 * scale, 6 * scale, tailWag * 0.1, 0, Math.PI*2);
        ctx.fill();
    }

    // Hands (Floating) - Draw THIRD (High Z-Index) when NOT facing up
    if (entity.facing !== 'up') {
        // Left Hand
        ctx.fillStyle = `hsl(${hue}, 70%, 80%)`;
        drawDetailedPaw(cx - 9 * scale + hxL, cy - 4 * scale + bob + hyL, 4 * scale);

        // Right Hand (Holds Gun)
        ctx.fillStyle = `hsl(${hue}, 70%, 80%)`;
        drawDetailedPaw(handRX, handRY, 4 * scale);

        // Gun
        if (!isNpc) drawGun(ctx, handRX, handRY, entity.aimAngle || 0, scale, cooldown);
    }

    // Name tag
    if (!isNpc && entity.username) {
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        // Untransform for text readability if we want, but letting it bounce is funny
        ctx.fillText(entity.username, cx, headY - 16 * scale);
    } 

    // Interaction Indicator
    if (isNpc && entity.canTalk) {
        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("!", cx, headY - 21 * scale);
    }

    ctx.restore(); 
}

function drawGun(ctx, x, y, angle, scale, cooldown = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (Math.abs(angle) > Math.PI / 2) {
        ctx.scale(1, -1);
    }

    // Basic Plasma Gun SVG-style
    // Gun Body
    ctx.fillStyle = '#555';
    ctx.fillRect(0, -2 * scale, 12 * scale, 4 * scale); // Main barrel

    // Handle
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, 3 * scale, 5 * scale);

    // Plasma Core (Glow) as cooldown bar
    const coreMaxLen = 6 * scale;
    const coreLen = coreMaxLen * cooldown;
    const alpha = 0.3 + 0.7 * cooldown;

    ctx.fillStyle = `rgba(0,255,255,${alpha})`;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 5;

    // Bar starts near the grip and grows toward the barrel tip
    ctx.fillRect(2 * scale, -1 * scale, coreLen, 2 * scale);

    ctx.shadowBlur = 0;

    // Nozzle tip
    ctx.fillStyle = '#222';
    ctx.fillRect(12 * scale, -1.5 * scale, 2 * scale, 3 * scale);

    ctx.restore();
}