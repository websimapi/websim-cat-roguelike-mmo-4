export const CONFIG = {
    TILE_SIZE: 32,
    GRID_W: 23, // 21 playable + 2 borders
    GRID_H: 12, // 10 playable + 2 borders
    PLAYABLE_W: 21,
    PLAYABLE_H: 10,
    OFFSET_X: 1, // Border offset
    OFFSET_Y: 1,
    SCALE: 2, // Visual zoom
    PLAYER_SPEED: 4.5, // Tiles per second (Normalized for DT)
    PROJECTILE_SPEED: 24, // Tiles per second
    FIRE_RATE: 0.8, // Seconds (was 800ms)
    PROJECTILE_RADIUS: 0.1, // Small bullet
};

// Map definition: 0 = Floor, 1 = Wall/Border
export const MAP_DATA = [];

// Initialize Grid (Hollow box)
for (let y = 0; y < CONFIG.GRID_H; y++) {
    const row = [];
    for (let x = 0; x < CONFIG.GRID_W; x++) {
        if (x === 0 || x === CONFIG.GRID_W - 1 || y === 0 || y === CONFIG.GRID_H - 1) {
            row.push(1); // Wall
        } else if (y === 1 && (x === 10 || x === 12)) {
            // Vestibule walls for the North Exit (creating a corridor effect)
            row.push(1);
        } else {
            row.push(0); // Floor
        }
    }
    MAP_DATA.push(row);
}