/**
 * BlueHound 3D animated assistant (v0).
 *
 * Lazy-loadable module. Tries WebGL + Three.js; if unavailable or the module
 * fails to load, falls back to the existing 2D avatar element without throwing.
 * Free-tier loads the 2D fallback; Pro tier unlocks the 3D avatar + premium skins.
 *
 * Usage from index.html:
 *   var script = document.createElement('script');
 *   script.src = 'assistant3d.js';
 *   script.onload = function(){ window.BH3D && window.BH3D.init(document.getElementById('assistantHost')); };
 *   document.head.appendChild(script);
 *
 * Three.js is loaded from a CDN on demand (not bundled) so the free bundle
 * stays small.
 */

(function (root) {
    "use strict";

    var THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
    var LOAD_TIMEOUT_MS = 8000;

    function hasWebGL() {
        try {
            var c = document.createElement("canvas");
            return !!(c.getContext && (c.getContext("webgl2") || c.getContext("webgl")));
        } catch (e) {
            return false;
        }
    }

    function ensureThree(cb) {
        if (root.THREE) { cb(root.THREE); return; }
        if (!hasWebGL()) { cb(null); return; }
        var script = document.createElement("script");
        script.type = "module";
        script.src = THREE_CDN;
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; cb(null); } }, LOAD_TIMEOUT_MS);
        script.onload = function () { if (done) return; done = true; clearTimeout(timer); cb(root.THREE || null); };
        script.onerror = function () { if (done) return; done = true; clearTimeout(timer); cb(null); };
        document.head.appendChild(script);
    }

    var state = { scene: null, renderer: null, camera: null, mesh: null, raf: null, fallbackShown: false };

    function showFallback(host) {
        if (state.fallbackShown) return;
        state.fallbackShown = true;
        if (!host) return;
        host.innerHTML = "";
        var img = document.createElement("img");
        img.src = "assets/bluehound.png";
        img.alt = "BlueHound";
        img.style.cssText = "width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 12px #33ccff);";
        host.appendChild(img);
    }

    function init(host) {
        if (!host) return;
        ensureThree(function (THREE) {
            if (!THREE) { showFallback(host); return; }
            try {
                var w = host.clientWidth || 240;
                var h = host.clientHeight || 240;
                state.scene = new THREE.Scene();
                state.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
                state.camera.position.set(0, 0, 3);
                state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                state.renderer.setSize(w, h);
                state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                host.innerHTML = "";
                host.appendChild(state.renderer.domElement);
                // simple placeholder avatar: a glowing icosahedron (skin swap point)
                var geo = new THREE.IcosahedronGeometry(0.9, 2);
                var mat = new THREE.MeshStandardMaterial({ color: 0x33ccff, metalness: 0.4, roughness: 0.3, emissive: 0x0a3a5a });
                state.mesh = new THREE.Mesh(geo, mat);
                state.scene.add(state.mesh);
                var light = new THREE.DirectionalLight(0xffffff, 1.0);
                light.position.set(2, 3, 4);
                state.scene.add(light);
                state.scene.add(new THREE.AmbientLight(0x336699, 0.6));
                var clock = new THREE.Clock();
                function tick() {
                    state.raf = requestAnimationFrame(tick);
                    if (state.mesh) {
                        state.mesh.rotation.y += 0.005;
                        state.mesh.scale.setScalar(1 + 0.02 * Math.sin(clock.getElapsedTime() * 2));
                    }
                    state.renderer.render(state.scene, state.camera);
                }
                tick();
                window.addEventListener("resize", function () {
                    if (!state.renderer) return;
                    var nw = host.clientWidth || 240, nh = host.clientHeight || 240;
                    state.camera.aspect = nw / nh;
                    state.camera.updateProjectionMatrix();
                    state.renderer.setSize(nw, nh);
                });
            } catch (e) {
                console.warn("BH3D init failed, falling back:", e);
                showFallback(host);
            }
        });
    }

    function destroy() {
        if (state.raf) cancelAnimationFrame(state.raf);
        state.raf = null;
        if (state.renderer) { try { state.renderer.dispose(); } catch (e) {} }
        state.renderer = null; state.mesh = null; state.scene = null; state.camera = null;
    }

    function speak(text) {
        if (!window.speechSynthesis) return;
        try {
            var u = new SpeechSynthesisUtterance(text);
            u.rate = 1.05; u.pitch = 1.0;
            window.speechSynthesis.speak(u);
        } catch (e) {}
    }

    root.BH3D = { init: init, destroy: destroy, speak: speak, hasWebGL: hasWebGL };
})(typeof window !== "undefined" ? window : globalThis);
