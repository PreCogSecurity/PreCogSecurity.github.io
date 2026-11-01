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

    // Premium skins (free + paid). The mesh material colour/pattern is the visual
    // differentiator; skins are unlocked by license tier (see license.js).
    var SKINS = [
        { id: "default", label: "Default", tier: "free", color: 0x33ccff, emissive: 0x0a3a5a },
        { id: "hacker", label: "Hacker", tier: "free", color: 0x33ff99, emissive: 0x0a3a1a },
        { id: "analyst", label: "Analyst", tier: "free", color: 0xa855f7, emissive: 0x1a0a3a },
        { id: "crimson", label: "Crimson", tier: "pro", color: 0xff3366, emissive: 0x3a0a1a },
        { id: "gold", label: "Gold", tier: "pro", color: 0xffcc33, emissive: 0x3a2a0a },
        { id: "ghost", label: "Ghost", tier: "pro", color: 0xffffff, emissive: 0x1a1a2a },
        { id: "matrix", label: "Matrix", tier: "pro", color: 0x00ff88, emissive: 0x003a1a },
        { id: "neon", label: "Neon", tier: "pro", color: 0xff33ff, emissive: 0x3a0a3a },
        { id: "ice", label: "Ice", tier: "pro", color: 0x99ffff, emissive: 0x0a2a3a },
        { id: "ember", label: "Ember", tier: "pro", color: 0xff8833, emissive: 0x3a1a0a },
        { id: "phantom", label: "Phantom", tier: "pro", color: 0x667788, emissive: 0x0a0a1a },
    ];

    var REACTION_COLORS = {
        // severity -> mesh emissive intensity bump
        info: 0x0a3a5a,
        low: 0x0a3a1a,
        medium: 0x3a2a0a,
        high: 0x3a1a0a,
        critical: 0x3a0a1a,
        success: 0x0a3a3a,
    };

    function currentSkin() {
        try {
            if (root.BHLicense && root.BHLicense.isPaid && root.BHLicense.isPaid()) {
                var k = localStorage.getItem("bh_3d_skin");
                if (k) { for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === k) return SKINS[i]; }
            }
        } catch (e) {}
        return SKINS[0];
    }

    function applySkin(skin) {
        if (!state.mesh || !skin) return;
        state.mesh.material.color.setHex(skin.color);
        if (state.mesh.material.emissive) state.mesh.material.emissive.setHex(skin.emissive);
    }

    function react(kind) {
        // kind: 'scan-start' | 'scan-ok' | 'scan-warn' | 'scan-crit' | 'error' | 'idle'
        if (!state.mesh) return;
        var em = REACTION_COLORS.medium;
        var scale = 1.0;
        if (kind === "scan-start") { em = REACTION_COLORS.info; scale = 1.02; }
        else if (kind === "scan-ok") { em = REACTION_COLORS.success; scale = 1.05; }
        else if (kind === "scan-warn") { em = REACTION_COLORS.medium; scale = 1.04; }
        else if (kind === "scan-crit") { em = REACTION_COLORS.critical; scale = 1.08; }
        else if (kind === "error") { em = REACTION_COLORS.high; scale = 0.96; }
        if (state.mesh.material.emissive) state.mesh.material.emissive.setHex(em);
        state.mesh.scale.setScalar(scale);
        setTimeout(function () { if (state.mesh) state.mesh.scale.setScalar(1); }, 600);
    }

    function setSkin(skinId) {
        if (!root.BHLicense || !root.BHLicense.isPaid()) {
            // free tier: only free skins
            var free = null;
            for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === skinId && SKINS[i].tier === "free") free = SKINS[i];
            if (!free) return false;
        }
        var chosen = null;
        for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === skinId) chosen = SKINS[i];
        if (!chosen) return false;
        if (chosen.tier === "pro" && !(root.BHLicense && root.BHLicense.isPaid && root.BHLicense.isPaid())) return false;
        try { localStorage.setItem("bh_3d_skin", skinId); } catch (e) {}
        applySkin(chosen);
        return true;
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
                var skin = currentSkin();
                var mat = new THREE.MeshStandardMaterial({ color: skin.color, metalness: 0.4, roughness: 0.3, emissive: skin.emissive });
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

    root.BH3D = { init: init, destroy: destroy, speak: speak, hasWebGL: hasWebGL, setSkin: setSkin, react: react, SKINS: SKINS, currentSkin: currentSkin };
})(typeof window !== "undefined" ? window : globalThis);
