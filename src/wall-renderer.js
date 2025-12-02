import { CONFIG, MAP_DATA } from './config.js';
import { ASSETS } from './assets.js';

export function drawWall(renderer, x, y, camX, camY) {
    const ctx = renderer.ctx;
    const tileSize = CONFIG.TILE_SIZE * CONFIG.SCALE;
    const pos = renderer.gridToScreen(x, y, camX, camY);
    
    // Cull off-screen, with a generous margin so walls de-render later and re-render sooner
    if (
        pos.x < -tileSize * 3 ||
        pos.x > renderer.canvas.width + tileSize * 3 ||
        pos.y < -tileSize * 3 ||
        pos.y > renderer.canvas.height + tileSize * 2
    ) return;

    // Dynamic Perspective Calculation
    // Walls skew based on player position
    const shearX = (x - camX) * 1.5; 
    const shear = shearX * (tileSize / 32);
    
    const topX = pos.x + shear;
    const topY = pos.y - tileSize;

    // Fix gaps between sheared top faces (crease lines)
    // Calculate gap size based on shear difference
    const shearPerTile = 1.5 * (tileSize / 32);
    const gapFix = Math.ceil(Math.abs(shearPerTile)) + 2;

    // Only widen if connecting to a neighbor wall to the right
    // This prevents obscuring the side face on the Left Wall boundary
    let drawWidth = tileSize;
    if (x < CONFIG.GRID_W - 1 && MAP_DATA[y] && MAP_DATA[y][x+1] === 1) {
        drawWidth = tileSize + gapFix;
    }

    const gateX = Math.floor(CONFIG.GRID_W / 2);
    const gateY = Math.floor(CONFIG.GRID_H / 2);
    
    const isLeftGate = (x === 0 && y === gateY);
    const isRightGate = (x === CONFIG.GRID_W - 1 && y === gateY);
    const isTopGate = (x === gateX && y === 0);
    const isBottomGate = (x === gateX && y === CONFIG.GRID_H - 1);
    const isBoundaryX = (x === 0 || x === CONFIG.GRID_W - 1);

    // Special rendering for North & South Gate Pillars (Vestibule)
    // These only draw their interior face (facing the corridor)
    const isNorthVestibule = (y === 1 && (x === gateX - 1 || x === gateX + 1));
    const isSouthVestibule = (y === CONFIG.GRID_H && (x === gateX - 1 || x === gateX + 1));
    if (isNorthVestibule || isSouthVestibule) {
         ctx.save();
         // Interior face:
         // Left Pillar (x < gateX): Draw Right Face
         // Right Pillar (x > gateX): Draw Left Face
         
         const originX = (x < gateX) ? pos.x + tileSize : pos.x;
         
         ctx.setTransform(
             shear / tileSize, -1, 0, 1, originX, pos.y - tileSize
         );

         ctx.drawImage(ASSETS.wall, 0, 0, tileSize, tileSize);
         
         // Darken slightly for depth
         ctx.fillStyle = 'rgba(0,0,0,0.3)';
         ctx.fillRect(0, 0, tileSize, tileSize);
         
         ctx.restore();
         return;
    }

    // 1. Side Gate Floor Indicator (Glow)
    if (isLeftGate || isRightGate) {
            const dist = Math.abs(x - camX);
            const intensity = Math.max(0.3, 1.2 - dist / 10);
            
            ctx.save();
            const gX = isLeftGate ? pos.x + tileSize : pos.x;
            const gY = pos.y + tileSize / 2;
            
            const gradient = ctx.createRadialGradient(gX, gY, 1, gX, gY, tileSize * 2.5);
            gradient.addColorStop(0, `rgba(200, 230, 255, ${0.4 * intensity})`);
            gradient.addColorStop(0.5, `rgba(100, 200, 255, ${0.1 * intensity})`);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(pos.x - tileSize*2, pos.y - tileSize, tileSize * 5, tileSize * 3);
            ctx.restore();
    }

    // Check if internal side face (neighbor is also wall)
    let isInternal = false;
    if (x < camX) {
        const nx = x + 1;
        if (nx < CONFIG.GRID_W && MAP_DATA[y] && MAP_DATA[y][nx] === 1) isInternal = true;
    } else if (x > camX) {
        const nx = x - 1;
        if (nx >= 0 && MAP_DATA[y] && MAP_DATA[y][nx] === 1) isInternal = true;
    }

    // 2. Draw Side Faces (The "3D" extrusion)
    // Skip if boundary (handled by special drawer) OR if internal (avoids creases)
    if (!isBoundaryX && !isInternal) {
        ctx.save();
        ctx.fillStyle = '#4a4a4a'; // Darker stone for sides

        // Left Wall (We see its Right Face if looking from right)
        if (x < camX) { 
            ctx.beginPath();
            ctx.moveTo(pos.x + tileSize, pos.y);
            ctx.lineTo(pos.x + tileSize, pos.y + tileSize);
            ctx.lineTo(topX + tileSize, topY + tileSize);
            ctx.lineTo(topX + tileSize, topY);
            ctx.fill();
        } 
        // Right Wall (We see its Left Face if looking from left)
        else if (x > camX) {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(pos.x, pos.y + tileSize);
            ctx.lineTo(topX, topY + tileSize);
            ctx.lineTo(topX, topY);
            ctx.fill();
        }
        ctx.restore();
    }
    
    // 2.5 Special Textured Side Faces for Boundary Walls
    if (isBoundaryX) {
        // Skip drawing side face if connecting to an internal wall (corners) to prevent artifacts
        let skipSideFace = false;
        if (x === 0 && x + 1 < CONFIG.GRID_W && MAP_DATA[y] && MAP_DATA[y][x+1] === 1) skipSideFace = true;
        if (x === CONFIG.GRID_W - 1 && x - 1 >= 0 && MAP_DATA[y] && MAP_DATA[y][x-1] === 1) skipSideFace = true;

        if (!skipSideFace) {
            ctx.save();
            
            // We use a transform to map the wall texture onto the sheared side face parallelogram
            // Origin of the transform depends on which side we are drawing
            const originX = (x === 0) ? pos.x + tileSize : pos.x;
            
            // Matrix transformation:
            // x' = (shear/tileSize)*x + 0*y + originX
            // y' = -1*x + 1*y + pos.y
            ctx.setTransform(
                shear / tileSize, // Horizontal Skew (Slope of the depth vector)
                -1,               // Vertical Skew (Depth goes UP)
                0,                // No Horizontal skew from Y
                1,                // Vertical Scale
                originX,          // Translate X
                pos.y             // Translate Y
            );

            // Draw the wall texture onto the side face
            ctx.drawImage(ASSETS.wall, 0, 0, tileSize, tileSize);

            // Darken the side face for depth perception (Reduced opacity to see texture)
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, tileSize, tileSize);

            // Draw Gate Hole on the side face if needed (flat-bottomed arch)
            if ((x === 0 && isLeftGate) || (x === CONFIG.GRID_W - 1 && isRightGate)) {
                ctx.fillStyle = '#1a1a1a'; // Match void color
                
                // Swap orientation: Width along Y (depth), Height along X (vertical)
                const doorHeight = tileSize * 0.95;
                const doorRadius = tileSize * 0.48; 
                const yCenter = tileSize / 2;

                ctx.beginPath();
                // Base at X=0 (Floor)
                ctx.moveTo(0, yCenter - doorRadius);
                // Go up to start of arch
                ctx.lineTo(doorHeight - doorRadius, yCenter - doorRadius);
                // Arch at top (bulging towards +X)
                ctx.arc(doorHeight - doorRadius, yCenter, doorRadius, -Math.PI/2, Math.PI/2, false);
                // Back down
                ctx.lineTo(0, yCenter + doorRadius);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // 3. Draw Front Face
    ctx.save();
    // Skew Front Face to match the leaning wall (connects base to sheared top)
    // Matrix: [1, 0, -shear/tileSize, 1, pos.x + shear, pos.y]
    ctx.setTransform(1, 0, -shear/tileSize, 1, pos.x + shear, pos.y);

    // Treat side gates like top/bottom gates for the cutout shape
    if (isTopGate || isBottomGate || isLeftGate || isRightGate) {
        // Top/Bottom/Side Gate Arch
        ctx.beginPath();
        // Allow clip to extend to drawWidth to fill gaps
        // Extended top (-2) to allow seam filler
        ctx.rect(0, -2, drawWidth, tileSize + 2);
        
        const cxDoor = tileSize / 2;
        const bottom = tileSize;
        const doorW = tileSize * 0.5; 
        const arcCy = bottom - tileSize * 0.5;

        ctx.moveTo(cxDoor + doorW, bottom);
        ctx.lineTo(cxDoor + doorW, arcCy);
        ctx.arc(cxDoor, arcCy, doorW, 0, Math.PI, true);
        ctx.lineTo(cxDoor - doorW, bottom);
        ctx.closePath();
        
        ctx.clip();

        // Seam Fix: Dark strip behind the top crease to hide 1px gaps
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -1.5, drawWidth, 2);

        ctx.drawImage(ASSETS.wall, 0, 0, drawWidth, tileSize);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    } else {
        // Seam Fix: Dark strip behind the top crease
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -1.5, drawWidth, 2);

        // Standard Solid Front
        ctx.drawImage(ASSETS.wall, 0, 0, drawWidth, tileSize);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Front face is darker
        ctx.fillRect(0, 0, drawWidth, tileSize);
    }
    ctx.restore();

    // 4. Draw Top Face
    ctx.drawImage(ASSETS.wall, topX, topY, drawWidth, tileSize);
}

export function drawGateOverlay(renderer, y, camX, camY) {
    const ctx = renderer.ctx;
    const tileSize = CONFIG.TILE_SIZE * CONFIG.SCALE;

    for (let x = 0; x < CONFIG.GRID_W; x++) {
        if (MAP_DATA[y][x] !== 1) continue;

        const gateX = Math.floor(CONFIG.GRID_W / 2);
        const gateY = Math.floor(CONFIG.GRID_H / 2);
        
        const isLeftGate = (x === 0 && y === gateY);
        const isRightGate = (x === CONFIG.GRID_W - 1 && y === gateY);
        const isTopGate = (x === gateX && y === 0);
        const isBottomGate = (x === gateX && y === CONFIG.GRID_H - 1);

        if (!isLeftGate && !isRightGate && !isTopGate && !isBottomGate) continue;

        const pos = renderer.gridToScreen(x, y, camX, camY);

        // Cull gate overlays with the same relaxed bounds as walls so they de-render together
        if (
            pos.x < -tileSize * 3 ||
            pos.x > renderer.canvas.width + tileSize * 3 ||
            pos.y < -tileSize * 3 ||
            pos.y > renderer.canvas.height + tileSize * 2
        ) {
            continue;
        }

        const shearX = (x - camX) * 1.5; 
        const shear = shearX * (tileSize / 32);
        const topX = pos.x + shear;
        const topY = pos.y - tileSize;
        
        // Gap fix calc matches main loop
        const shearPerTile = 1.5 * (tileSize / 32);
        const gapFix = Math.ceil(Math.abs(shearPerTile)) + 2;
        let drawWidth = tileSize;
        if (x < CONFIG.GRID_W - 1 && MAP_DATA[y][x+1] === 1) drawWidth = tileSize + gapFix;

        // 1. Redraw Side Face (Left/Right Gates)
        if (isLeftGate || isRightGate) {
            ctx.save();
            const originX = (x === 0) ? pos.x + tileSize : pos.x;
            ctx.setTransform(shear / tileSize, -1, 0, 1, originX, pos.y);
            
            ctx.drawImage(ASSETS.wall, 0, 0, tileSize, tileSize);
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, tileSize, tileSize);

            // Gate Hole on Side
            ctx.fillStyle = '#1a1a1a'; 
            const doorHeight = tileSize * 0.95;
            const doorRadius = tileSize * 0.48; 
            const yCenter = tileSize / 2;
            ctx.beginPath();
            ctx.moveTo(0, yCenter - doorRadius);
            ctx.lineTo(doorHeight - doorRadius, yCenter - doorRadius);
            ctx.arc(doorHeight - doorRadius, yCenter, doorRadius, -Math.PI/2, Math.PI/2, false);
            ctx.lineTo(0, yCenter + doorRadius);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 2. Redraw Front Face
        ctx.save();
        ctx.setTransform(1, 0, -shear/tileSize, 1, pos.x + shear, pos.y);
        
        ctx.beginPath();
        // Extended top (-2) to allow seam filler
        ctx.rect(0, -2, drawWidth, tileSize + 2);
        
        const cxDoor = tileSize / 2;
        const bottom = tileSize;
        const doorW = tileSize * 0.5; 
        const arcCy = bottom - tileSize * 0.5;

        ctx.moveTo(cxDoor + doorW, bottom);
        ctx.lineTo(cxDoor + doorW, arcCy);
        ctx.arc(cxDoor, arcCy, doorW, 0, Math.PI, true);
        ctx.lineTo(cxDoor - doorW, bottom);
        ctx.closePath();
        
        ctx.clip();
        
        // Seam Fix
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -1.5, drawWidth, 2);

        ctx.drawImage(ASSETS.wall, 0, 0, drawWidth, tileSize);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
        ctx.restore();

        // 3. Redraw Top Face
        ctx.drawImage(ASSETS.wall, topX, topY, drawWidth, tileSize);
    }
}