/**
 * Mahindra UDO EV Web Companion - 60 FPS HTML5 Canvas Engine & Cloud Sync
 */

(function () {
    // State Variables
    let direction = -1; // -1: Left, 1: Right
    let gear = "D";     // P, R, N, D
    let driveMode = "Ride"; // Creep, Range, Ride, Race
    let headlights = true;
    let isCharging = false;

    let batteryPercent = 100.0;
    let odometerKm = 0.0;
    let currentRangeKm = 205.0;
    let rechargeTimeRemainingSec = 0;

    let posX = 100;
    let speedX = 0;
    let frameIdx = 0;

    let facts = [];
    let activeFactIndex = 0;

    // Canvas Setup
    const canvas = document.getElementById("udoCanvas");
    const ctx = canvas.getContext("2d");
    const speechBubbleText = document.getElementById("speechBubbleText");

    // Load Images
    const imgLeft = new Image();
    imgLeft.src = "/static/udo_left.png";

    const imgRight = new Image();
    imgRight.src = "/static/udo_right.png";

    const imgWheelRear = new Image();
    imgWheelRear.src = "/static/wheel_rear.png";

    // Audio Setup
    const hornAudio = new Audio("/static/udo_horn.wav");

    // Initialize Canvas Dimensions
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth || 700;
        canvas.height = 260;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // -------------------------------------------------------------
    // CONTROLS & EVENT LISTENERS
    // -------------------------------------------------------------
    window.setGear = function (g) {
        if (batteryPercent <= 0 && g !== "P") {
            showSpeech("⚡ Battery Exhausted! Fast Charging... 3 min full charge time!");
            return;
        }
        gear = g;
        document.querySelectorAll(".gear-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.gear === g);
        });

        if (g === "P") showSpeech("Park Mode Engaged 🅿️ Brake Locked");
        else if (g === "D") showSpeech("Drive Mode Engaged 🛺 Cruising smoothly!");
        else if (g === "R") showSpeech("Reverse Gear Engaged 🔙 Beep... Beep...");
        else if (g === "N") showSpeech("Neutral Gear ⚪ Idling");
    };

    window.setDriveMode = function (m) {
        driveMode = m;
        document.querySelectorAll(".mode-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.mode === m);
        });

        if (m === "Creep") showSpeech("Creep Mode Active 🐌 Moving super slowly!");
        else if (m === "Range") showSpeech("Range Mode Active 🔋 Eco-friendly >200 km cruise!");
        else if (m === "Ride") showSpeech("Ride Mode Active 🛺 Smooth & comfortable!");
        else if (m === "Race") showSpeech("Race Mode Active! Auto Nahi, Auto Plane Bolo! 🛺✈️⚡");
    };

    window.toggleHeadlights = function () {
        headlights = !headlights;
        showSpeech(headlights ? "LED Headlight Beams ON 💡" : "LED Headlight Beams OFF 🌙");
    };

    window.toggleCharger = function () {
        if (!isCharging) {
            gear = "P";
            setGear("P");
            isCharging = true;

            // Pro-Rata 3 Minute Fast Charging Calculation
            const missingPercent = 100.0 - batteryPercent;
            rechargeTimeRemainingSec = (missingPercent / 100.0) * 180.0;

            const m = Math.floor(rechargeTimeRemainingSec / 60);
            const s = Math.floor(rechargeTimeRemainingSec % 60);
            showSpeech(`⚡ Plugged into Fast Charger! ${m}m ${s.toString().padStart(2, '0')}s remaining to full charge!`);
        }
    };

    window.honkHorn = function () {
        hornAudio.currentTime = 0;
        hornAudio.play().catch(e => console.log("Audio play deferred:", e));
        showSpeech("Honk Honk! 📢 Real Mahindra UDO EV Horn! 🛺⚡");
    };

    window.showRandomFact = function () {
        if (facts.length > 0) {
            activeFactIndex = (activeFactIndex + 1) % facts.length;
            showSpeech(facts[activeFactIndex]);
        }
    };

    function showSpeech(msg) {
        if (speechBubbleText) {
            speechBubbleText.textContent = msg;
        }
    }

    // -------------------------------------------------------------
    // ANIMATION & PHYSICS ENGINE (60 FPS)
    // -------------------------------------------------------------
    function getModeSpeed() {
        if (gear === "P" || gear === "N") return 0;
        let baseSpeed = 2.0;
        if (driveMode === "Creep") baseSpeed = 0.5;
        else if (driveMode === "Range") baseSpeed = 1.5;
        else if (driveMode === "Ride") baseSpeed = 2.5;
        else if (driveMode === "Race") baseSpeed = 4.0;

        return gear === "R" ? -baseSpeed : baseSpeed;
    }

    function updatePhysics() {
        frameIdx++;

        // Fast Charger Tick
        if (isCharging) {
            if (batteryPercent < 100.0) {
                batteryPercent += (100.0 / 180.0) * 0.016;
                batteryPercent = Math.min(100.0, batteryPercent);
                rechargeTimeRemainingSec = Math.max(0, ((100.0 - batteryPercent) / 100.0) * 180.0);
            } else {
                isCharging = false;
                showSpeech("🔋 Battery 100% Fully Charged! Ready for >200 km range! 🛺⚡");
            }
        }

        // Movement Physics
        const targetSpeed = getModeSpeed();
        speedX += (targetSpeed - speedX) * 0.1;

        if (Math.abs(speedX) > 0.05 && batteryPercent > 0 && !isCharging) {
            posX += speedX;
            direction = speedX > 0 ? 1 : -1;

            // Odometer & Battery Depletion
            const distKm = (Math.abs(speedX) * 0.016) / 10.0;
            odometerKm += distKm;
            batteryPercent = Math.max(0, batteryPercent - (distKm / 205.0) * 100.0);
            currentRangeKm = (batteryPercent / 100.0) * 205.0;

            if (batteryPercent <= 0) {
                gear = "P";
                setGear("P");
                showSpeech("⚡ Battery Exhausted! Vehicle Stopped! Fast Charging... 3 min full charge!");
                toggleCharger();
            }
        }

        // Screen Bounce Boundaries
        const carW = 150;
        if (posX < 20) {
            posX = 20;
            speedX = Math.abs(speedX);
            direction = 1;
        } else if (posX > canvas.width - carW - 20) {
            posX = canvas.width - carW - 20;
            speedX = -Math.abs(speedX);
            direction = -1;
        }

        // Update Telemetry Display
        document.getElementById("statBattery").textContent = `${Math.floor(batteryPercent)}%`;
        document.getElementById("statRange").textContent = `${Math.floor(currentRangeKm)} km`;
        document.getElementById("statOdometer").textContent = `${odometerKm.toFixed(1)} km`;
    }

    // -------------------------------------------------------------
    // CANVAS RENDERER
    // -------------------------------------------------------------
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const isMoving = (Math.abs(speedX) > 0.05) && (gear !== "P" && gear !== "N") && !isCharging;
        const bob = isMoving ? Math.sin(frameIdx * 0.2) * 1.5 : 0;

        const cx = posX;
        const cy = canvas.height - 130 + bob;
        const carW = 150;
        const carH = 98;

        // 1. LED Headlight Beams 💡🚘 (UNCROPPED)
        if (headlights) {
            const hx = direction < 0 ? cx + 16 : cx + carW - 16;
            const hy = cy + 45;

            // Outer Flare Cone
            ctx.beginPath();
            if (direction < 0) {
                ctx.moveTo(hx, hy - 2);
                ctx.lineTo(hx - 75, hy - 26);
                ctx.lineTo(hx - 75, hy + 30);
                ctx.lineTo(hx, hy + 2);
            } else {
                ctx.moveTo(hx, hy - 2);
                ctx.lineTo(hx + 75, hy - 26);
                ctx.lineTo(hx + 75, hy + 30);
                ctx.lineTo(hx, hy + 2);
            }
            ctx.closePath();

            const gradOuter = ctx.createLinearGradient(hx, hy, direction < 0 ? hx - 75 : hx + 75, hy);
            gradOuter.addColorStop(0, "rgba(0, 220, 255, 0.45)");
            gradOuter.addColorStop(1, "rgba(0, 220, 255, 0)");
            ctx.fillStyle = gradOuter;
            ctx.fill();

            // Inner Core Beam
            ctx.beginPath();
            if (direction < 0) {
                ctx.moveTo(hx, hy - 1);
                ctx.lineTo(hx - 70, hy - 14);
                ctx.lineTo(hx - 70, hy + 18);
                ctx.lineTo(hx, hy + 1);
            } else {
                ctx.moveTo(hx, hy - 1);
                ctx.lineTo(hx + 70, hy - 14);
                ctx.lineTo(hx + 70, hy + 18);
                ctx.lineTo(hx, hy + 1);
            }
            ctx.closePath();

            const gradCore = ctx.createLinearGradient(hx, hy, direction < 0 ? hx - 70 : hx + 70, hy);
            gradCore.addColorStop(0, "rgba(255, 255, 245, 0.9)");
            gradCore.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = gradCore;
            ctx.fill();

            // Bulb Glow
            ctx.beginPath();
            ctx.arc(hx, hy, 3, 0, 2 * Math.PI);
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.fill();
        }

        // 2. Draw Mahindra UDO EV Image
        const carImg = direction < 0 ? imgLeft : imgRight;
        if (carImg.complete && carImg.naturalWidth > 0) {
            ctx.drawImage(carImg, cx, cy, carW, carH);
        }

        // 3. Spinning Rear Alloy Wheel Photo ⚙️🛺 (EXACT HUB CENTER ALIGNMENT)
        if (imgWheelRear.complete && imgWheelRear.naturalWidth > 0) {
            const rx = direction < 0 ? cx + 126.1 : cx + 23.7;
            const ry = cy + 84.4;
            const wheelSize = 30;

            const spinRad = isMoving ? (frameIdx * 0.15 * (direction > 0 ? 1 : -1)) % (2 * Math.PI) : 0;

            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(spinRad);
            ctx.drawImage(imgWheelRear, -wheelSize / 2, -wheelSize / 2, wheelSize, wheelSize);
            ctx.restore();
        }

        // 4. Ground Shadow
        ctx.beginPath();
        ctx.ellipse(cx + carW / 2, canvas.height - 30, carW * 0.45, 8, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();
    }

    function gameLoop() {
        updatePhysics();
        render();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();

    // -------------------------------------------------------------
    // CLOUD SYNC & LIVE ADMIN BROADCAST POLLING
    // -------------------------------------------------------------
    function syncCloud() {
        // Fetch Facts
        fetch("/api/facts")
            .then(res => res.json())
            .then(data => {
                if (data.facts && data.facts.length > 0) {
                    facts = data.facts;
                }
            })
            .catch(err => console.log("Offline facts fallback active"));

        // Fetch Live Admin Broadcasts
        fetch("/api/broadcast")
            .then(res => res.json())
            .then(data => {
                if (data.message && data.message.length > 0) {
                    showSpeech(`📢 ADMIN BROADCAST: ${data.message}`);
                }
            })
            .catch(err => console.log("Broadcast poll offline"));

        // Heartbeat
        fetch("/api/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "Web Companion User", device: "Browser" })
        }).catch(err => {});
    }

    // Initial Sync & 10s Timer Loop
    syncCloud();
    setInterval(syncCloud, 10000);

    // Rotate Facts every 12 seconds
    setInterval(() => {
        if (facts.length > 0 && !isCharging) {
            window.showRandomFact();
        }
    }, 12000);

})();
