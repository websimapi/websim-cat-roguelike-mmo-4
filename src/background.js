export function initBackground() {
    const canvas = document.getElementById('bgCanvas');
    const gl = canvas.getContext('webgl');

    if (!gl) {
        console.error('WebGL not supported for background');
        return;
    }

    // Vertex Shader
    const vsSource = `
        attribute vec2 position;
        void main() {
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    // Fragment Shader - "The Rift"
    const fsSource = `
        precision highp float;
        uniform vec2 iResolution;
        uniform float iTime;

        // --- Noise Functions ---
        vec3 hash33(vec3 p) { 
            p = fract(p * vec3(443.8975, 397.2973, 491.1871));
            p += dot(p.zxy, p.yxz + 19.19);
            return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
        }

        float noise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(dot(hash33(i + vec3(0,0,0)).x, 1.0), 
                               dot(hash33(i + vec3(1,0,0)).x, 1.0), f.x),
                           mix(dot(hash33(i + vec3(0,1,0)).x, 1.0), 
                               dot(hash33(i + vec3(1,1,0)).x, 1.0), f.x), f.y),
                       mix(mix(dot(hash33(i + vec3(0,0,1)).x, 1.0), 
                               dot(hash33(i + vec3(1,0,1)).x, 1.0), f.x),
                           mix(dot(hash33(i + vec3(0,1,1)).x, 1.0), 
                               dot(hash33(i + vec3(1,1,1)).x, 1.0), f.x), f.y), f.z);
        }

        float fbm(vec3 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; ++i) {
                v += a * noise(p);
                p *= 2.0;
                a *= 0.5;
            }
            return v;
        }

        // Domain warping curl-ish noise
        float warp(vec3 p, out vec3 q, out vec3 r) {
            q = vec3(fbm(p + vec3(0.0,0.0,0.0)),
                     fbm(p + vec3(5.2,1.3,2.8)),
                     fbm(p + vec3(1.1,2.2,3.3)));

            r = vec3(fbm(p + 4.0*q + vec3(1.7,9.2,5.2)),
                     fbm(p + 4.0*q + vec3(8.3,2.8,1.1)),
                     fbm(p + 4.0*q + vec3(1.2,3.4,5.6)));

            return fbm(p + 4.0*r);
        }

        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

            // Time variables
            float t = iTime * 0.2;
            float pulse = 1.0 + 0.4 * sin(t * 3.0); // 0.6 to 1.4

            // Base coordinate for the rift (vertical scaling)
            vec2 p = uv;
            p.x *= 1.5; // Stretch horizontally to make vertical rift feel thinner/taller relative to noise

            // Distort coordinates (Screen Space Refraction)
            vec3 q, r;
            float n = warp(vec3(p * 3.0, t * 0.5), q, r);

            // Spiral / Swirl effect
            float angle = atan(uv.y, uv.x);
            float len = length(uv);
            float spiral = sin(len * 10.0 - t * 2.0 + angle * 2.0);

            // Color Palette
            // Core: Magenta/Purple, Edges: Teal/Indigo
            vec3 colPurple = vec3(0.5, 0.0, 0.5);
            vec3 colMagenta = vec3(0.8, 0.1, 0.6);
            vec3 colTeal = vec3(0.0, 0.6, 0.6);
            vec3 colIndigo = vec3(0.1, 0.0, 0.3);

            // Mix colors based on noise and depth
            vec3 color = mix(colIndigo, colTeal, clamp(length(q), 0.0, 1.0));
            color = mix(color, colPurple, clamp(length(r), 0.0, 1.0));

            // Highlight the rift core
            float core = 1.0 - smoothstep(0.0, 0.5 + 0.1 * pulse, length(uv * vec2(3.0, 1.5)));
            // Add turbulence
            core += n * 0.2;

            vec3 riftColor = mix(colMagenta, vec3(1.0, 0.8, 0.5), core * core); // Hot center

            // Compose final color
            vec3 finalColor = mix(color * 0.3, riftColor, core);

            // Bloom / Glow (fake)
            finalColor += vec3(0.4, 0.2, 0.6) * pow(n, 3.0) * pulse * 0.5;

            // Chromatic Aberration at edges
            float ab = length(uv) * 0.02;
            // (Simple approximation by tinting based on gradient)
            finalColor.r += ab;
            finalColor.b -= ab;

            // Vignette
            float vig = 1.0 - smoothstep(0.4, 1.2, length(uv));
            finalColor *= vig;

            // Deep background fade
            finalColor = mix(vec3(0.02, 0.02, 0.05), finalColor, 0.8);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // Shader compilation helpers
    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Shader program failed to link');
        return;
    }

    // Buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Locations
    const positionLocation = gl.getAttribLocation(program, "position");
    const resolutionLocation = gl.getUniformLocation(program, "iResolution");
    const timeLocation = gl.getUniformLocation(program, "iTime");

    function resize() {
        // Performance fix: Render at 1/4 resolution.
        // CSS will scale it up, providing a retro pixelated look and saving massive GPU time.
        const scale = 0.25; 
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;

        // Match the same logic as the main canvas so the background fills the rotated landscape
        if (isPortrait) {
            canvas.width = Math.ceil(h * scale);
            canvas.height = Math.ceil(w * scale);
        } else {
            canvas.width = Math.ceil(w * scale);
            canvas.height = Math.ceil(h * scale);
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    // Render Loop
    function render(now) {
        const timeInSeconds = now * 0.001;

        gl.useProgram(program);

        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform1f(timeLocation, timeInSeconds);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}