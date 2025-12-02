// ... existing code ...

render(gameState, localPlayerId) {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (!ASSETS.loaded) return;

    // Camera follows local player
    let camX = CONFIG.GRID_W / 2;
    let camY = CONFIG.GRID_H / 2;

    if (gameState.players[localPlayerId]) {
        const p = gameState.players[localPlayerId];
        camX = p.x;
        camY = p.y;
    }

    const tileSize = CONFIG.TILE_SIZE * CONFIG.SCALE;
    const gateX = 11; // 11th grid tile (Center of 23)
    const gateY = Math.floor(CONFIG.GRID_H / 2);

    // Bucket Entities by Row for Depth Sorting
    const entitiesByRow = Array.from({ length: CONFIG.GRID_H }, () => []);

    // ... existing code ...

    // Add NPCs, Players, Projectiles
    gameState.npcs.forEach(npc => addToBucket('npc', npc));
    Object.values(gameState.players).forEach(p => addToBucket('player', p));
    gameState.projectiles.forEach(p => addToBucket('projectile', p));

    // 1. Draw ALL Floors First (Background Layer)
    // This ensures floor exists under walls as requested
    for (let y = 0; y < CONFIG.GRID_H; y++) {
        for (let x = 0; x < CONFIG.GRID_W; x++) {
            // Skip floor at Top Exit to show Void
            if (x === gateX && y === 0) continue;

            const pos = this.gridToScreen(x, y, camX, camY);
            // Relaxed culling so floors disappear later and reappear earlier
            if (
                pos.x < -tileSize * 2 ||
                pos.x > width + tileSize * 2 ||
                pos.y < -tileSize * 2 ||
                pos.y > height + tileSize * 2
            ) continue;
            
            // Draw grass texture repeated 4 times inside each grid tile (2x2 sub-tiles)
            const subSize = tileSize / 2;
            for (let oy = 0; oy < 2; oy++) {
                for (let ox = 0; ox < 2; ox++) {
                    ctx.drawImage(
                        ASSETS.floor,
                        pos.x + ox * subSize,
                        pos.y + oy * subSize,
                        subSize,
                        subSize
                    );
                }
            }
        }
    }

    // 2. Draw Walls, Props, and Entities (Sorted by Row for correct occlusion)
    for (let y = 0; y < CONFIG.GRID_H; y++) {
        // A. Draw Walls for this row
        for (let x = 0; x < CONFIG.GRID_W; x++) {
            if (MAP_DATA[y][x] === 1) {
                const pos = this.gridToScreen(x, y, camX, camY);
                // Cull off-screen with a larger margin so walls de-render later
                if (
                    pos.x < -tileSize * 3 ||
                    pos.x > width + tileSize * 3 ||
                    pos.y < -tileSize * 3 ||
                    pos.y > height + tileSize * 2
                ) continue;

                // Dynamic Perspective Calculation
                // Walls skew based on player position
                const shearX = (x - camX) * 1.5; 
                const shear = shearX * (tileSize / 32);
                
                const topX = pos.x + shear;
                const topY = pos.y - tileSize;

                const gateX = Math.floor(CONFIG.GRID_W / 2);
                const gateY = Math.floor(CONFIG.GRID_H / 2);
                
                const isLeftGate = (x === 0 && y === gateY);
                const isRightGate = (x === CONFIG.GRID_W - 1 && y === gateY);
                const isTopGate = (x === gateX && y === 0);
                const isBottomGate = (x === gateX && y === CONFIG.GRID_H - 1);

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

                // 2. Draw Side Faces (The "3D" extrusion)
                // Only draw side faces for the outer boundary walls to avoid internal saw-toothing
                if (x === 0 || x === CONFIG.GRID_W - 1) {
                    ctx.save();
                    
                    // We use a transform to map the wall texture onto the sheared side face parallelogram
                    // Origin of the transform depends on which side we are drawing
                    const originX = (x === 0) ? pos.x + tileSize : pos.x;
                    
                    // Matrix transformation:
                    // x' = (shear/tileSize)*x + 0*y + originX
                    // y' = -1*x + 1*y + pos.y
                    // This maps the texture rectangle (0,0,w,h) to the parallelogram
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

                    // Darken the side face for depth perception
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(0, 0, tileSize, tileSize);

                    // Draw Gate Hole on the side face if needed
                    if ((x === 0 && isLeftGate) || (x === CONFIG.GRID_W - 1 && isRightGate)) {
                        ctx.fillStyle = '#1a1a1a'; // Match void color
                        ctx.beginPath();
                        // Center of the texture in transformed space
                        ctx.ellipse(tileSize/2, tileSize/2, tileSize * 0.25, tileSize * 0.35, 0, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                }

                // 3. Draw Front Face
                if (isTopGate || isBottomGate) {
                    // Top/Bottom Gate Arch
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(pos.x, pos.y, tileSize, tileSize);
                    
                    const cx = pos.x + tileSize / 2;
                    const bottom = pos.y + tileSize;
                    const doorW = tileSize * 0.5; 
                    const arcCy = bottom - tileSize * 0.5;

                    ctx.moveTo(cx + doorW, bottom);
                    ctx.lineTo(cx + doorW, arcCy);
                    ctx.arc(cx, arcCy, doorW, 0, Math.PI, true);
                    ctx.lineTo(cx - doorW, bottom);
                    ctx.closePath();
                    
                    ctx.clip();
                    ctx.drawImage(ASSETS.wall, pos.x, pos.y, tileSize, tileSize);
                    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
                    ctx.restore();
                } else {
                    // Standard Solid Front
                    ctx.drawImage(ASSETS.wall, pos.x, pos.y, tileSize, tileSize);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Front face is darker
                    ctx.fillRect(pos.x, pos.y, tileSize, tileSize);
                }

                // 4. Draw Top Face
                // We slightly expand the width to cover small gaps caused by differential shearing between adjacent tiles
                const gapFix = Math.ceil(Math.abs(shearX * (tileSize/32) * 1.5)) + 2; 
                ctx.drawImage(ASSETS.wall, topX, topY, tileSize + gapFix, tileSize);
            }
        }

        // B. Draw Shop (Base at row 3)
        // ... existing code ...