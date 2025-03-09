// DOM elements
const splashScreen = document.getElementById('splash-screen');
const appContainer = document.getElementById('app-container');
const viewfinder = document.getElementById('viewfinder');
const photoPreview = document.getElementById('photo-preview');
const shutterButton = document.getElementById('shutter-button');
const switchCameraButton = document.getElementById('switch-camera');
const galleryButton = document.getElementById('gallery-button');
const backToCameraButton = document.getElementById('back-to-camera');
const togglePawModeButton = document.getElementById('toggle-paw-mode');
const flashToggleButton = document.getElementById('flash-toggle');
const hdrToggleButton = document.getElementById('hdr-toggle');
const timerToggleButton = document.getElementById('timer-toggle');
const gridToggleButton = document.getElementById('grid-toggle');
const exposureControl = document.getElementById('exposure-control');
const filterEffects = document.querySelectorAll('.filter-effect-preview');
const modeOptions = document.querySelectorAll('.mode-option');
const photoGallery = document.getElementById('photo-gallery');
const compositionGrid = document.getElementById('composition-grid');
const settingsButton = document.getElementById('settings-button');
const levelIndicator = document.getElementById('level-indicator');
const qualitySetting = document.getElementById('quality-setting');
const stackFramesSetting = document.getElementById('stack-frames-setting');
const superResToggle = document.getElementById('super-res-toggle');
const cameraScreen = document.getElementById('camera-screen');
const galleryScreen = document.getElementById('gallery-screen');
const editScreen = document.getElementById('edit-screen');
const settingsScreen = document.getElementById('settings-screen');
const backToSettingsButton = document.getElementById('back-to-camera-from-settings');
const galleryTabs = document.querySelectorAll('.gallery-tab');
const resolutionDisplay = document.getElementById('resolution-display');
const modeIndicator = document.getElementById('mode-indicator');
const effectsButton = document.getElementById('effects-button');

// App state
let facingMode = 'environment';
let stream = null;
let currentMode = 'photo';
let currentFilter = 'normal';
let flashMode = 'off';
let isHDRActive = false;
let isPawMode = false;
let isTakingPhoto = false;
let isTimerActive = false;
let isGridVisible = false;
let stackFrameCount = 10;
let isSuperResEnabled = false;
let qualityLevel = 'high';
let savedPhotos = JSON.parse(localStorage.getItem('pawShotPhotos') || '[]');
let deviceOrientation = { alpha: 0, beta: 0, gamma: 0 };
let exposureCompensation = 0;
let timer = null;
let videoTrack = null;
let captureCanvas = null;
let captureContext = null;

// Mode titles
const modeTitles = {
    'photo': 'Normal',
    'portrait': 'Portrait',
    'night': 'Night',
    'action': 'Action',
    'selfie': 'Selfie'
};

// App settings
let appSettings = {
    soundEnabled: true,
    saveOriginal: true,
    highQuality: true,
    gridEnabled: false,
    timerDuration: 0,
    defaultFilter: 'normal'
};

// Initialize camera
async function initCamera() {
    try {
        // Request camera access with constraints
        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 3840 },
                height: { ideal: 2160 },
                frameRate: { ideal: 30 }
            },
            audio: false
        };

        // Get media stream
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Set video source
        viewfinder.srcObject = stream;
        
        // Play video
        await viewfinder.play();
        
        // Store video track for later use
        videoTrack = stream.getVideoTracks()[0];
        
        // Create canvas for capturing photos
        captureCanvas = document.createElement('canvas');
        captureContext = captureCanvas.getContext('2d');
        
        // Set canvas size based on video dimensions
        resizeCanvas();
        
        // Update resolution display
        updateResolutionDisplay();
        
        // Apply current mode settings
        applyModeSettings(currentMode);
        
        // Hide splash screen when camera is ready
        splashScreen.classList.add('hidden');
        
        console.log('Camera initialized successfully');
    } catch (error) {
        console.error('Camera initialization error:', error);
        showNotification('Camera access error. Please check permissions.', 'error');
    }
}

// Update resolution display
function updateResolutionDisplay() {
    if (videoTrack) {
        const settings = videoTrack.getSettings();
        resolutionDisplay.textContent = `${settings.width}×${settings.height}`;
    }
}

// Resize canvas to match video dimensions
function resizeCanvas() {
    if (!viewfinder || !captureCanvas) return;
    
    // Set canvas dimensions to match video
    captureCanvas.width = viewfinder.videoWidth;
    captureCanvas.height = viewfinder.videoHeight;
}

// Stop camera
async function stopCamera() {
    if (stream) {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        videoTrack = null;
    }
}

// Capture photo
async function capturePhoto() {
    if (isTakingPhoto || !videoTrack) return;
    
    isTakingPhoto = true;
    
    // Check if timer is enabled
    if (appSettings.timerDuration > 0 && !isTimerActive) {
        startTimer();
        return;
    }
    
    try {
        // Create high-res canvas
        resizeCanvas();
        
        // Draw current frame to canvas
        captureContext.drawImage(viewfinder, 0, 0, captureCanvas.width, captureCanvas.height);
        
        // Flash effect
        flashScreen();
        
        // Play shutter sound
        playSound('shutter');
        
        // Process image based on current mode and filter
        processImage();
        
        // Reset timer state
        isTimerActive = false;
        
        // Show notification
        showNotification('Photo captured!', 'success');
    } catch (error) {
        console.error('Error capturing photo:', error);
        showNotification('Failed to capture photo', 'error');
        isTakingPhoto = false;
    }
}

// Process captured image
function processImage() {
    // Get original image data
    const originalData = captureCanvas.toDataURL('image/jpeg', qualityLevel === 'high' ? 0.95 : 0.85);
    
    // Apply current filter
    if (currentFilter !== 'normal') {
        applyFilterToCanvas(captureContext, captureCanvas.width, captureCanvas.height, currentFilter);
    }
    
    // Apply special modes
    if (currentMode === 'portrait') {
        applyPortraitEffect(captureContext, captureCanvas.width, captureCanvas.height);
    } else if (currentMode === 'night') {
        applyNightEffect(captureContext, captureCanvas.width, captureCanvas.height);
    } else if (isHDRActive) {
        applyHDREffect(captureContext, captureCanvas.width, captureCanvas.height);
    }
    
    // Apply paw overlay if enabled
    if (isPawMode) {
        applyPawOverlay(captureContext, captureCanvas.width, captureCanvas.height);
    }
    
    // Get processed image data
    const processedData = captureCanvas.toDataURL('image/jpeg', qualityLevel === 'high' ? 0.95 : 0.85);
    
    // Save photo
    const photoData = appSettings.saveOriginal ? originalData : processedData;
    savePhotoToGallery(photoData, currentMode);
    
    // Show preview
    showPhotoPreview(processedData);
    
    // Reset taking photo state
    isTakingPhoto = false;
}

// Apply filter to canvas
function applyFilterToCanvas(context, width, height, filter) {
    switch (filter) {
        case 'normal':
            // No filter
            break;
            
        case 'bw':
            applyBWFilter(context, width, height);
            break;
            
        case 'sepia':
            applySepiaFilter(context, width, height);
            break;
            
        case 'vintage':
            applyVintageFilter(context, width, height);
            break;
            
        case 'vivid':
            applyVividFilter(context, width, height);
            break;
            
        case 'dramatic':
            applyDramaticFilter(context, width, height);
            break;
            
        case 'noir':
            applyNoirFilter(context, width, height);
            break;
            
        case 'pawify':
            applyPawifyFilter(context, width, height);
            break;
    }
}

// Start timer countdown
function startTimer() {
    isTimerActive = true;
    let countdown = appSettings.timerDuration;
    
    // Create timer display
    const timerDisplay = document.createElement('div');
    timerDisplay.className = 'timer-display';
    timerDisplay.textContent = countdown;
    appContainer.appendChild(timerDisplay);
    
    // Play sound
    playSound('focus');
    
    // Update countdown every second
    timer = setInterval(() => {
        countdown--;
        timerDisplay.textContent = countdown;
        
        if (countdown <= 0) {
            // Clear interval
            clearInterval(timer);
            
            // Remove display
            timerDisplay.remove();
            
            // Capture photo
            isTakingPhoto = false;
            capturePhoto();
        }
    }, 1000);
}

// Apply B&W filter
function applyBWFilter(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
        data[i] = brightness;
        data[i + 1] = brightness;
        data[i + 2] = brightness;
    }
    
    context.putImageData(imageData, 0, 0);
    
    // Add slight contrast
    context.save();
    context.globalCompositeOperation = 'multiply';
    context.globalAlpha = 0.1;
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.restore();
}

// Apply Sepia filter
function applySepiaFilter(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
    }
    
    context.putImageData(imageData, 0, 0);
    
    // Add slight vignette
    addVignette(context, width, height, 0.8);
}

// Apply Vintage filter
function applyVintageFilter(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Faded colors
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Warm vintage tone
        data[i] = Math.min(255, r * 1.1 + 15);
        data[i + 1] = Math.min(255, g * 0.9);
        data[i + 2] = Math.min(255, b * 0.8);
        
        // Reduce contrast
        data[i] = data[i] * 0.9 + 25;
        data[i + 1] = data[i + 1] * 0.9 + 25;
        data[i + 2] = data[i + 2] * 0.9 + 25;
    }
    
    context.putImageData(imageData, 0, 0);
    
    // Add vignette
    addVignette(context, width, height, 1.2);
    
    // Add slight grain
    addNoise(context, width, height, 10);
    
    // Add subtle light leak
    context.save();
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255, 200, 100, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
    context.globalCompositeOperation = 'overlay';
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.restore();
}

// Apply Vivid filter
function applyVividFilter(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Convert to HSL
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
                // Increase saturation and contrast
                s = Math.min(1, s * 1.5);
                l = l < 0.5 ? l * 0.9 : l + (1 - l) * 0.1; // Increase contrast
                
                // Convert back to RGB
                let r1, g1, b1;
                
                if (s === 0) {
                    r1 = g1 = b1 = l;
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1/6) return p + (q - p) * 6 * t;
                        if (t < 1/2) return q;
                        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                        return p;
                    };
                    
                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    const p = 2 * l - q;
                    
                    r1 = hue2rgb(p, q, h + 1/3);
                    g1 = hue2rgb(p, q, h);
                    b1 = hue2rgb(p, q, h - 1/3);
                }
                
                // Convert back to 0-255 range
                data[i] = Math.round(r1 * 255);
                data[i + 1] = Math.round(g1 * 255);
                data[i + 2] = Math.round(b1 * 255);
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add more vibrancy
            context.save();
            context.globalCompositeOperation = 'overlay';
            context.globalAlpha = 0.1;
            context.fillStyle = '#0080ff';
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        
        // Apply Dramatic filter
        function applyDramaticFilter(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Increase contrast
                data[i] = 128 + (data[i] - 128) * 1.4;
                data[i + 1] = 128 + (data[i + 1] - 128) * 1.4;
                data[i + 2] = 128 + (data[i + 2] - 128) * 1.4;
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add dark vignette
            addVignette(context, width, height, 1.5);
            
            // Add dramatic color tint
            context.save();
            context.globalCompositeOperation = 'overlay';
            context.globalAlpha = 0.2;
            
            const gradient = context.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#003366');
            gradient.addColorStop(1, '#660033');
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        
        // Apply Noir filter
        function applyNoirFilter(context, width, height) {
            // First convert to high contrast B&W
            applyBWFilter(context, width, height);
            
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Increase contrast even more
            for (let i = 0; i < data.length; i += 4) {
                data[i] = data[i] < 120 ? data[i] * 0.8 : 128 + (data[i] - 128) * 1.2;
                data[i + 1] = data[i];
                data[i + 2] = data[i];
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add dark vignette
            addVignette(context, width, height, 2);
            
            // Add slight grain
            addNoise(context, width, height, 8);
            
            // Add blue tint
            context.save();
            context.globalCompositeOperation = 'overlay';
            context.globalAlpha = 0.15;
            context.fillStyle = '#000066';
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        
        // Apply Pawify filter
        function applyPawifyFilter(context, width, height) {
            // Add warm, pet-friendly tone
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] * 1.1); // More red
                data[i + 1] = Math.min(255, data[i + 1] * 1.05); // Slightly more green
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add soft glow
            context.save();
            context.globalCompositeOperation = 'overlay';
            context.globalAlpha = 0.2;
            context.fillStyle = '#ffcc99';
            context.fillRect(0, 0, width, height);
            context.restore();
            
            // Add paw prints in corners
            addPawDecoration(context, width, height);
        }
        
        // Add paw decoration to image
        function addPawDecoration(context, width, height) {
            context.save();
            
            // Create paw shape
            function drawPaw(x, y, size) {
                context.beginPath();
                context.arc(x, y, size, 0, Math.PI * 2); // Main pad
                context.arc(x - size, y - size, size * 0.6, 0, Math.PI * 2); // Toe 1
                context.arc(x + size, y - size, size * 0.6, 0, Math.PI * 2); // Toe 2
                context.arc(x - size * 1.2, y, size * 0.6, 0, Math.PI * 2); // Toe 3
                context.arc(x + size * 1.2, y, size * 0.6, 0, Math.PI * 2); // Toe 4
                context.fill();
            }
            
            // Set style for paws
            context.globalAlpha = 0.2;
            context.fillStyle = '#ff6699';
            
            // Draw paws in corners
            const pawSize = width * 0.05;
            drawPaw(pawSize * 1.5, pawSize * 1.5, pawSize);
            drawPaw(width - pawSize * 1.5, pawSize * 1.5, pawSize);
            drawPaw(pawSize * 1.5, height - pawSize * 1.5, pawSize);
            drawPaw(width - pawSize * 1.5, height - pawSize * 1.5, pawSize);
            
            context.restore();
        }
        
        // Apply portrait mode effect
        function applyPortraitEffect(context, width, height) {
            // Simple blur simulation for background
            // In a real app, this would use depth sensing or ML for subject detection
            // but we'll simulate with a radial gradient
            
            // Create temporary canvas for blur effect
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempContext = tempCanvas.getContext('2d');
            
            // Copy original to temp
            tempContext.drawImage(captureCanvas, 0, 0);
            
            // Create blur on temp canvas
            stackBlur(tempContext, 0, 0, width, height, 12);
            
            // Create mask for portrait subject (simplified as oval in center)
            const centerX = width / 2;
            const centerY = height / 2;
            const radiusX = width * 0.3;
            const radiusY = height * 0.5;
            
            // Create gradient mask
            const gradient = context.createRadialGradient(
                centerX, centerY, Math.min(radiusX, radiusY) * 0.8,
                centerX, centerY, Math.min(radiusX, radiusY) * 1.5
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Transparent center (subject)
            gradient.addColorStop(1, 'rgba(0, 0, 0, 1)'); // Opaque edges (blurred background)
            
            // Draw blurred version based on mask
            context.save();
            context.globalCompositeOperation = 'destination-in';
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, height);
            context.restore();
            
            // Draw original image with inverted mask
            context.save();
            context.globalCompositeOperation = 'destination-over';
            tempContext.globalCompositeOperation = 'source-atop';
            tempContext.fillStyle = 'rgba(0, 0, 0, 1)';
            context.drawImage(tempCanvas, 0, 0);
            context.restore();
            
            // Add slight vignette
            addVignette(context, width, height, 0.7);
        }
        
        // Apply night mode effect
        function applyNightEffect(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Brighten dark areas, reduce noise, enhance details
            for (let i = 0; i < data.length; i += 4) {
                // Brighten shadows
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Average brightness
                const brightness = (r + g + b) / 3;
                
                // Apply logarithmic brightening to dark areas
                const brightnessFactor = brightness < 80 ? 1.5 - Math.log10(brightness + 10) * 0.3 : 1;
                
                data[i] = Math.min(255, r * brightnessFactor);
                data[i + 1] = Math.min(255, g * brightnessFactor);
                data[i + 2] = Math.min(255, b * brightnessFactor);
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Apply noise reduction (simple blur for demonstration)
            if (brightness < 100) {
                stackBlur(context, 0, 0, width, height, 2);
            }
            
            // Add slight blue tint for night atmosphere
            context.save();
            context.globalCompositeOperation = 'overlay';
            context.globalAlpha = 0.15;
            context.fillStyle = '#003366';
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        
        // Apply HDR effect 
        function applyHDREffect(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Enhance local contrast
            for (let i = 0; i < data.length; i += 4) {
                // Increase contrast in mid-tones
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Calculate brightness
                const brightness = (r + g + b) / 3;
                
                // Apply different adjustments based on brightness
                let factor;
                if (brightness < 60) {
                    // Shadows - brighten slightly
                    factor = 1.2;
                } else if (brightness > 190) {
                    // Highlights - reduce slightly
                    factor = 0.9;
                } else {
                    // Mid-tones - increase contrast
                    factor = 1.1;
                }
                
                data[i] = Math.min(255, r * factor);
                data[i + 1] = Math.min(255, g * factor);
                data[i + 2] = Math.min(255, b * factor);
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add vibrancy
            context.save();
            context.globalCompositeOperation = 'overlay';
            context.globalAlpha = 0.15;
            context.fillStyle = '#0099cc';
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        
        // Apply paw overlay
        function applyPawOverlay(context, width, height) {
            // Add paw print overlay
            context.save();
            
            // Draw multiple paw prints
            for (let i = 0; i < 5; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = width * (0.03 + Math.random() * 0.02);
                const rotation = Math.random() * Math.PI * 2;
                
                context.translate(x, y);
                context.rotate(rotation);
                
                // Draw paw
                context.globalAlpha = 0.3;
                context.fillStyle = '#ffffff';
                
                // Main pad
                context.beginPath();
                context.ellipse(0, 0, size, size * 1.2, 0, 0, Math.PI * 2);
                context.fill();
                
                // Toes
                for (let j = 0; j < 4; j++) {
                    const toeAngle = j * Math.PI / 2;
                    const toeX = Math.cos(toeAngle) * size * 1.2;
                    const toeY = Math.sin(toeAngle) * size * 1.2;
                    
                    context.beginPath();
                    context.ellipse(toeX, toeY, size * 0.5, size * 0.6, toeAngle, 0, Math.PI * 2);
                    context.fill();
                }
                
                context.rotate(-rotation);
                context.translate(-x, -y);
            }
            
            context.restore();
        }
        
        // Add vignette effect
        function addVignette(context, width, height, intensity = 1) {
            context.save();
            
            // Create radial gradient
            const gradient = context.createRadialGradient(
                width / 2, height / 2, Math.min(width, height) * 0.4,
                width / 2, height / 2, Math.min(width, height) * 0.7
            );
            
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(0, 0, 0, ${0.3 * intensity})`);
            
            // Apply gradient
            context.globalCompositeOperation = 'multiply';
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        
        // Add noise/grain effect
        function addNoise(context, width, height, intensity = 10) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const noise = Math.random() * intensity - intensity / 2;
                
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
            }
            
            context.putImageData(imageData, 0, 0);
        }
        
        // Stack Blur function (simplified version)
        function stackBlur(context, x, y, width, height, radius) {
            if (radius < 1) return;
            
            const imageData = context.getImageData(x, y, width, height);
            const data = imageData.data;
            
            // Simplified gaussian blur implementation
            const divider = radius * 2 + 1;
            
            // Horizontal pass
            for (let y = 0; y < height; y++) {
                let sum_r = 0, sum_g = 0, sum_b = 0;
                const yOffset = y * width * 4;
                
                // Initialize sum for first pixel
                for (let i = -radius; i <= radius; i++) {
                    const x = Math.min(Math.max(0, i), width - 1);
                    const offset = yOffset + x * 4;
                    sum_r += data[offset];
                    sum_g += data[offset + 1];
                    sum_b += data[offset + 2];
                }
                
                // Process row
                for (let x = 0; x < width; x++) {
                    const currentOffset = yOffset + x * 4;
                    const firstOffset = yOffset + Math.max(0, x - radius - 1) * 4;
                    const lastOffset = yOffset + Math.min(width - 1, x + radius) * 4;
                    
                    // Set pixel
                    data[currentOffset] = sum_r / divider;
                    data[currentOffset + 1] = sum_g / divider;
                    data[currentOffset + 2] = sum_b / divider;
                    
                    // Update sums for next pixel
                    if (x + radius < width) {
                        sum_r = sum_r - data[firstOffset] + data[lastOffset];
                        sum_g = sum_g - data[firstOffset + 1] + data[lastOffset + 1];
                        sum_b = sum_b - data[firstOffset + 2] + data[lastOffset + 2];
                    }
                }
            }
            
            // Vertical pass
            for (let x = 0; x < width; x++) {
                let sum_r = 0, sum_g = 0, sum_b = 0;
                
                // Initialize sum for first pixel
                for (let i = -radius; i <= radius; i++) {
                    const y = Math.min(Math.max(0, i), height - 1);
                    const offset = (y * width + x) * 4;
                    sum_r += data[offset];
                    sum_g += data[offset + 1];
                    sum_b += data[offset + 2];
                }
                
                // Process column
                for (let y = 0; y < height; y++) {
                    const currentOffset = (y * width + x) * 4;
                    const firstOffset = (Math.max(0, y - radius - 1) * width + x) * 4;
                    const lastOffset = (Math.min(height - 1, y + radius) * width + x) * 4;
                    
                    // Set pixel
                    data[currentOffset] = sum_r / divider;
                    data[currentOffset + 1] = sum_g / divider;
                    data[currentOffset + 2] = sum_b / divider;
                    
                    // Update sums for next pixel
                    if (y + radius < height) {
                        sum_r = sum_r - data[firstOffset] + data[lastOffset];
                        sum_g = sum_g - data[firstOffset + 1] + data[lastOffset + 1];
                        sum_b = sum_b - data[firstOffset + 2] + data[lastOffset + 2];
                    }
                }
            }
            
            context.putImageData(imageData, x, y);
        }
        
        // Flash screen effect
        function flashScreen() {
            const flashElement = document.createElement('div');
            flashElement.className = 'screen-flash';
            appContainer.appendChild(flashElement);
            
            // Animate flash
            setTimeout(() => {
                flashElement.style.opacity = '0';
                setTimeout(() => {
                    flashElement.remove();
                }, 300);
            }, 50);
        }
        
        // Show photo preview
        function showPhotoPreview(photoData) {
            // Set preview image source
            photoPreview.src = photoData;
            
            // Show preview screen
            cameraScreen.classList.add('hidden');
            editScreen.classList.remove('hidden');
            
            // Enable share/save buttons on preview
            const saveButton = document.getElementById('save-photo');
            const shareButton = document.getElementById('share-photo');
            const retakeButton = document.getElementById('retake-photo');
            
            if (saveButton) {
                saveButton.addEventListener('click', () => {
                    savePhotoToDevice(photoData);
                });
            }
            
            if (shareButton) {
                shareButton.addEventListener('click', () => {
                    sharePhoto(photoData);
                });
            }
            
            if (retakeButton) {
                retakeButton.addEventListener('click', () => {
                    editScreen.classList.add('hidden');
                    cameraScreen.classList.remove('hidden');
                });
            }
        }
        
        // Save photo to gallery
        function savePhotoToGallery(photoData, mode) {
            // Create unique ID for photo
            const photoId = 'photo_' + Date.now();
            
            // Create photo object
            const photo = {
                id: photoId,
                data: photoData,
                mode: mode,
                filter: currentFilter,
                timestamp: Date.now(),
                metadata: {
                    orientation: deviceOrientation,
                    exposure: exposureCompensation,
                    hdr: isHDRActive,
                    pawMode: isPawMode
                }
            };
            
            // Add to saved photos array
            savedPhotos.unshift(photo);
            
            // Save to localStorage
            localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            
            // Update gallery count
            updateGalleryCount();
        }
        
        // Update gallery count indicator
        function updateGalleryCount() {
            const galleryCount = document.querySelector('.gallery-count');
            if (galleryCount) {
                galleryCount.textContent = savedPhotos.length;
                galleryCount.style.display = savedPhotos.length > 0 ? 'flex' : 'none';
            }
        }
        
        // Render gallery
        function renderGallery() {
            // Clear gallery
            photoGallery.innerHTML = '';
            
            if (savedPhotos.length === 0) {
                photoGallery.innerHTML = `
                    <div class="empty-gallery">
                        <i class="material-icons">photo_library</i>
                        <p>No photos yet</p>
                        <button id="take-first-photo" class="primary-button">Take your first photo</button>
                    </div>
                `;
                
                const takeFirstButton = document.getElementById('take-first-photo');
                if (takeFirstButton) {
                    takeFirstButton.addEventListener('click', () => {
                        galleryScreen.classList.add('hidden');
                        cameraScreen.classList.remove('hidden');
                    });
                }
                
                return;
            }
            
            // Create gallery grid
            const galleryGrid = document.createElement('div');
            galleryGrid.className = 'gallery-grid';
            
            // Add photos to grid
            savedPhotos.forEach(photo => {
                const photoItem = document.createElement('div');
                photoItem.className = 'gallery-item';
                photoItem.dataset.id = photo.id;
                
                photoItem.innerHTML = `
                    <img src="${photo.data}" alt="Pet photo">
                    <div class="gallery-item-overlay">
                        <div class="gallery-item-actions">
                            <button class="gallery-action view-photo" title="View">
                                <i class="material-icons">visibility</i>
                            </button>
                            <button class="gallery-action share-photo" title="Share">
                                <i class="material-icons">share</i>
                            </button>
                            <button class="gallery-action delete-photo" title="Delete">
                                <i class="material-icons">delete</i>
                            </button>
                        </div>
                        <div class="gallery-item-info">
                            <span class="gallery-item-date">${formatDate(photo.timestamp)}</span>
                            <span class="gallery-item-mode">${modeTitles[photo.mode] || photo.mode}</span>
                        </div>
                    </div>
                `;
                
                galleryGrid.appendChild(photoItem);
                
                // Add event listeners
                const viewButton = photoItem.querySelector('.view-photo');
                const shareButton = photoItem.querySelector('.share-photo');
                const deleteButton = photoItem.querySelector('.delete-photo');
                
                viewButton.addEventListener('click', () => {
                    viewPhoto(photo.id);
                });
                
                shareButton.addEventListener('click', () => {
                    sharePhoto(photo.data);
                });
                
                deleteButton.addEventListener('click', () => {
                    deletePhoto(photo.id);
                });
            });
            
            photoGallery.appendChild(galleryGrid);
        }
        
        // Format date for gallery
        function formatDate(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().split(':').slice(0, 2).join(':');
        }
        
        // View photo in full screen
        function viewPhoto(photoId) {
            const photo = savedPhotos.find(p => p.id === photoId);
            
            if (!photo) return;
            
            const overlay = document.createElement('div');
            overlay.className = 'photo-view-overlay';
            
            overlay.innerHTML = `
                <div class="photo-view-container">
                    <img src="${photo.data}" alt="Pet photo">
                    <div class="photo-view-info">
                        <div class="photo-view-date">${formatDate(photo.timestamp)}</div>
                        <div class="photo-view-mode">${modeTitles[photo.mode] || photo.mode} · ${photo.filter}</div>
                    </div>
                    <div class="photo-view-actions">
                        <button class="photo-action" id="edit-photo">
                            <i class="material-icons">edit</i>
                            <span>Edit</span>
                        </button>
                        <button class="photo-action" id="download-photo">
                            <i class="material-icons">download</i>
                            <span>Download</span>
                        </button>
                        <button class="photo-action" id="share-fullscreen-photo">
                            <i class="material-icons">share</i>
                            <span>Share</span>
                        </button>
                        <button class="photo-action" id="delete-fullscreen-photo">
                            <i class="material-icons">delete</i>
                            <span>Delete</span>
                        </button>
                    </div>
                    <button class="close-photo-view">×</button>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Add event listeners
            const closeButton = overlay.querySelector('.close-photo-view');
            const editButton = overlay.querySelector('#edit-photo');
            const downloadButton = overlay.querySelector('#download-photo');
            const shareButton = overlay.querySelector('#share-fullscreen-photo');
            const deleteButton = overlay.querySelector('#delete-fullscreen-photo');
            
            closeButton.addEventListener('click', () => {
                overlay.remove();
            });
            
            editButton.addEventListener('click', () => {
                overlay.remove();
                openPhotoEditor(photo);
            });
            
            downloadButton.addEventListener('click', () => {
                savePhotoToDevice(photo.data);
            });
            
            shareButton.addEventListener('click', () => {
                sharePhoto(photo.data);
            });
            
            deleteButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this photo?')) {
                    deletePhoto(photo.id);
                    overlay.remove();
                }
            });
        }
        
        // Open photo editor
        function openPhotoEditor(photo) {
            // In a real app, this would open a full editor
            // For now, we'll just show a notification
            showNotification('Photo editor coming soon!', 'info');
        }
        
        // Save photo to device
        function savePhotoToDevice(photoData) {
            // Create temporary download link
            const link = document.createElement('a');
            link.href = photoData;
            link.download = `pawshot_${Date.now()}.jpg`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show notification
            showNotification('Photo saved to downloads', 'success');
            playSound('success');
        }
        
        // Share photo
        function sharePhoto(photoData) {
            // Check if Web Share API is supported
            if (navigator.share) {
                // Convert data URL to Blob
                fetch(photoData)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], 'pawshot.jpg', { type: 'image/jpeg' });
                        
                        navigator.share({
                            title: 'My PawShot Photo',
                            text: 'Check out this photo I took with PawShot!',
                            files: [file]
                        })
                        .then(() => {
                            showNotification('Photo shared successfully', 'success');
                        })
                        .catch(error => {
                            console.error('Error sharing:', error);
                            showNotification('Sharing failed', 'error');
                        });
                    });
            } else {
                // Fallback: open in new tab/window
                const newTab = window.open();
                newTab.document.write(`<img src="${photoData}" alt="PawShot Photo" style="max-width: 100%;">`);
                showNotification('Photo opened in new tab', 'info');
                
                // Add download button in new tab
                newTab.document.write(`
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="${photoData}" download="pawshot.jpg" 
                           style="padding: 10px 20px; background: #ff4081; color: white; 
                                  text-decoration: none; border-radius: 20px; font-family: sans-serif;">
                            Download Photo
                        </a>
                    </div>
                `);
            }
        }
        
        // Delete photo
        function deletePhoto(photoId) {
            // Show confirmation dialog
            if (confirm('Are you sure you want to delete this photo?')) {
                        // Find photo index
        const photoIndex = savedPhotos.findIndex(p => p.id === photoId);
        
        if (photoIndex !== -1) {
            // Remove photo from array
            savedPhotos.splice(photoIndex, 1);
            
            // Update localStorage
            localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            
            // Update gallery count
            updateGalleryCount();
            
            // Re-render gallery
            renderGallery();
            
            // Show notification
            showNotification('Photo deleted', 'info');
        }
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="material-icons">${
                type === 'success' ? 'check_circle' :
                type === 'error' ? 'error' :
                type === 'warning' ? 'warning' : 'info'
            }</i>
        </div>
        <div class="notification-message">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
        
        // Auto dismiss after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }, 10);
}

// Play sound effect
function playSound(soundName) {
    if (!appSettings.soundEnabled) return;
    
    const sounds = {
        shutter: 'sounds/shutter.mp3',
        focus: 'sounds/focus.mp3',
        success: 'sounds/success.mp3',
        error: 'sounds/error.mp3'
    };
    
    if (sounds[soundName]) {
        const sound = new Audio(sounds[soundName]);
        sound.play().catch(err => console.log('Sound play error:', err));
    }
}

// Open settings screen
function openSettings() {
    cameraScreen.classList.add('hidden');
    settingsScreen.classList.remove('hidden');
    
    // Initialize settings UI based on current settings
    document.getElementById('sound-toggle').checked = appSettings.soundEnabled;
    document.getElementById('original-toggle').checked = appSettings.saveOriginal;
    document.getElementById('high-quality-toggle').checked = appSettings.highQuality;
    qualitySetting.value = qualityLevel;
    stackFramesSetting.value = stackFrameCount;
    superResToggle.checked = isSuperResEnabled;
    
    // Add settings change event listeners
    document.getElementById('sound-toggle').addEventListener('change', function() {
        appSettings.soundEnabled = this.checked;
        saveSettings();
    });
    
    document.getElementById('original-toggle').addEventListener('change', function() {
        appSettings.saveOriginal = this.checked;
        saveSettings();
    });
    
    document.getElementById('high-quality-toggle').addEventListener('change', function() {
        appSettings.highQuality = this.checked;
        qualityLevel = this.checked ? 'high' : 'standard';
        saveSettings();
    });
    
    qualitySetting.addEventListener('change', function() {
        qualityLevel = this.value;
        saveSettings();
    });
    
    stackFramesSetting.addEventListener('change', function() {
        stackFrameCount = parseInt(this.value, 10);
        saveSettings();
    });
    
    superResToggle.addEventListener('change', function() {
        isSuperResEnabled = this.checked;
        saveSettings();
    });
    
    // Back button
    backToSettingsButton.addEventListener('click', () => {
        settingsScreen.classList.add('hidden');
        cameraScreen.classList.remove('hidden');
    });
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
    showNotification('Settings saved', 'success');
}

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('pawShotSettings');
    
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            appSettings = { ...appSettings, ...parsed };
            
            // Apply settings
            qualityLevel = appSettings.highQuality ? 'high' : 'standard';
            isGridVisible = appSettings.gridEnabled;
            
            // Update UI based on settings
            if (compositionGrid) {
                compositionGrid.style.display = isGridVisible ? 'block' : 'none';
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

// Initialize app
function initApp() {
    // Load settings
    loadSettings();
    
    // Initialize event listeners
    setupEventListeners();
    
    // Update gallery count
    updateGalleryCount();
    
    // Initialize camera
    initCamera().catch(error => {
        console.error('Camera initialization error:', error);
        showNotification('Camera access error. Please check permissions.', 'error');
    });
    
    // Register service worker for PWA support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }
    
    // Register device orientation listener
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', event => {
            deviceOrientation = {
                alpha: event.alpha,
                beta: event.beta,
                gamma: event.gamma
            };
            
            // Update level indicator
            updateLevelIndicator();
        });
    }
}

// Update level indicator
function updateLevelIndicator() {
    if (!levelIndicator) return;
    
    // Check if device is level (gamma close to 0)
    const isLevel = Math.abs(deviceOrientation.gamma) < 5;
    levelIndicator.style.backgroundColor = isLevel ? '#4caf50' : '#ff9800';
    
    // Position indicator based on gamma angle
    const maxAngle = 45;
    const normalizedAngle = Math.max(-maxAngle, Math.min(maxAngle, deviceOrientation.gamma));
    const percentage = 50 + (normalizedAngle / maxAngle * 50);
    
    levelIndicator.style.left = `${percentage}%`;
}

// Setup all event listeners
function setupEventListeners() {
    // Shutter button
    shutterButton.addEventListener('click', () => {
        capturePhoto();
    });
    
    // Switch camera button
    switchCameraButton.addEventListener('click', () => {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        
        // Restart camera with new facing mode
        stopCamera().then(() => {
            initCamera();
        });
    });
    
    // Gallery button
    galleryButton.addEventListener('click', () => {
        cameraScreen.classList.add('hidden');
        galleryScreen.classList.remove('hidden');
        
        // Render gallery
        renderGallery();
    });
    
    // Back to camera from gallery
    backToCameraButton.addEventListener('click', () => {
        galleryScreen.classList.add('hidden');
        cameraScreen.classList.remove('hidden');
    });
    
    // Toggle paw mode
    togglePawModeButton.addEventListener('click', () => {
        isPawMode = !isPawMode;
        togglePawModeButton.classList.toggle('active', isPawMode);
    });
    
    // Flash toggle
    flashToggleButton.addEventListener('click', () => {
        const states = ['off', 'on', 'auto'];
        const currentIndex = states.indexOf(flashMode);
        flashMode = states[(currentIndex + 1) % states.length];
        
        // Update UI
        const flashIcon = flashToggleButton.querySelector('i');
        if (flashIcon) {
            flashIcon.textContent = flashMode === 'off' ? 'flash_off' : 
                                   flashMode === 'on' ? 'flash_on' : 'flash_auto';
        }
        
        // Apply flash setting if possible
        if (videoTrack) {
            try {
                const capabilities = videoTrack.getCapabilities();
                if (capabilities.torch) {
                    videoTrack.applyConstraints({
                        advanced: [{ torch: flashMode === 'on' }]
                    });
                }
            } catch (e) {
                console.log('Flash not supported:', e);
            }
        }
    });
    
    // HDR toggle
    hdrToggleButton.addEventListener('click', () => {
        isHDRActive = !isHDRActive;
        hdrToggleButton.classList.toggle('active', isHDRActive);
    });
    
    // Timer toggle
    timerToggleButton.addEventListener('click', () => {
        const timerOptions = [0, 3, 5, 10];
        let currentIndex = timerOptions.indexOf(appSettings.timerDuration);
        currentIndex = (currentIndex + 1) % timerOptions.length;
        appSettings.timerDuration = timerOptions[currentIndex];
        
        // Update UI
        const timerDisplay = timerToggleButton.querySelector('span');
        if (timerDisplay) {
            timerDisplay.textContent = appSettings.timerDuration === 0 ? 'Off' : `${appSettings.timerDuration}s`;
        }
        
        // Save setting
        saveSettings();
    });
    
    // Grid toggle
    gridToggleButton.addEventListener('click', () => {
        isGridVisible = !isGridVisible;
        appSettings.gridEnabled = isGridVisible;
        
        // Update grid visibility
        if (compositionGrid) {
            compositionGrid.style.display = isGridVisible ? 'block' : 'none';
        }
        
        // Update UI
        gridToggleButton.classList.toggle('active', isGridVisible);
        
        // Save setting
        saveSettings();
    });
    
    // Settings button
    settingsButton.addEventListener('click', openSettings);
    
    // Exposure control
    if (exposureControl) {
        exposureControl.addEventListener('input', function() {
            exposureCompensation = parseFloat(this.value);
            
            // Apply exposure if camera supports it
            if (videoTrack) {
                try {
                    const capabilities = videoTrack.getCapabilities();
                    if (capabilities.exposureCompensation) {
                        const min = capabilities.exposureCompensation.min;
                        const max = capabilities.exposureCompensation.max;
                        const mappedValue = min + (exposureCompensation + 2) * (max - min) / 4;
                        
                        videoTrack.applyConstraints({
                            advanced: [{ exposureCompensation: mappedValue }]
                        });
                    }
                } catch (e) {
                    console.log('Exposure control not supported:', e);
                }
            }
        });
    }
    
    // Filter effects
    filterEffects.forEach(effectButton => {
        effectButton.addEventListener('click', () => {
            // Update current filter
            currentFilter = effectButton.dataset.filter || 'normal';
            
            // Update UI
            filterEffects.forEach(btn => btn.classList.remove('active'));
            effectButton.classList.add('active');
        });
    });
    
    // Camera modes
    modeOptions.forEach(modeButton => {
        modeButton.addEventListener('click', () => {
            // Update current mode
            currentMode = modeButton.dataset.mode || 'photo';
            
            // Update UI
            modeOptions.forEach(btn => btn.classList.remove('active'));
            modeButton.classList.add('active');
            
            // Update mode indicator
            if (modeIndicator) {
                modeIndicator.textContent = modeTitles[currentMode] || currentMode;
            }
            
            // Apply mode-specific settings
            applyModeSettings(currentMode);
        });
    });
    
    // Gallery tabs
    galleryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            galleryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Filter gallery based on tab
            const filterType = tab.dataset.filter;
            renderFilteredGallery(filterType);
        });
    });
    
    // Effects button
    if (effectsButton) {
        effectsButton.addEventListener('click', () => {
            // Toggle effects panel
            const effectsPanel = document.querySelector('.filter-effects');
            if (effectsPanel) {
                effectsPanel.classList.toggle('expanded');
            }
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case ' ':  // Space bar
                capturePhoto();
                break;
            case 'g':  // Gallery
                galleryButton.click();
                break;
            case 'f':  // Flash
                flashToggleButton.click();
                break;
            case 't':  // Timer
                timerToggleButton.click();
                break;
            case 'c':  // Switch camera
                switchCameraButton.click();
                break;
            case 'h':  // HDR
                hdrToggleButton.click();
                break;
            case 'Escape':  // Back
                if (!galleryScreen.classList.contains('hidden')) {
                    backToCameraButton.click();
                } else if (!settingsScreen.classList.contains('hidden')) {
                    backToSettingsButton.click();
                } else if (!editScreen.classList.contains('hidden')) {
                    const retakeButton = document.getElementById('retake-photo');
                    if (retakeButton) retakeButton.click();
                }
                break;
        }
    });
    
    // Viewfinder touch events for focus
    viewfinder.addEventListener('click', (e) => {
        // Calculate tap position relative to video
        const rect = viewfinder.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        
        // Focus on tap point
        focusCamera(x, y);
        
        // Show focus indicator
        showFocusIndicator(e.clientX, e.clientY);
    });
    
    // Pinch to zoom
    let initialPinchDistance = 0;
    let currentZoom = 1;
    
    viewfinder.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialPinchDistance = getPinchDistance(e.touches);
            e.preventDefault();
        }
    });
    
    viewfinder.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && videoTrack) {
            const currentDistance = getPinchDistance(e.touches);
            const scaleFactor = currentDistance / initialPinchDistance;
            
            // Calculate new zoom
            let newZoom = currentZoom * scaleFactor;
            
                        // Get capabilities
                        const capabilities = videoTrack.getCapabilities();
            
                        if (capabilities.zoom) {
                            // Clamp zoom to device limits
                            const minZoom = capabilities.zoom.min || 1;
                            const maxZoom = capabilities.zoom.max || 10;
                            newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
                            
                            // Apply zoom
                            videoTrack.applyConstraints({
                                advanced: [{ zoom: newZoom }]
                            }).then(() => {
                                currentZoom = newZoom;
                            }).catch(e => {
                                console.log('Zoom not supported:', e);
                            });
                        }
                        
                        e.preventDefault();
                    }
                });
                
                // Orientation change
                window.addEventListener('orientationchange', () => {
                    // Resize canvas and update UI
                    setTimeout(() => {
                        resizeCanvas();
                        updateResolutionDisplay();
                    }, 300);
                });
            }
            
            // Get pinch distance between two touch points
            function getPinchDistance(touches) {
                const dx = touches[0].clientX - touches[1].clientX;
                const dy = touches[0].clientY - touches[1].clientY;
                return Math.sqrt(dx * dx + dy * dy);
            }
            
            // Show focus indicator
            function showFocusIndicator(x, y) {
                // Create or get existing focus indicator
                let focusIndicator = document.querySelector('.focus-indicator');
                
                if (!focusIndicator) {
                    focusIndicator = document.createElement('div');
                    focusIndicator.className = 'focus-indicator';
                    appContainer.appendChild(focusIndicator);
                }
                
                // Position indicator
                focusIndicator.style.left = `${x - 30}px`;
                focusIndicator.style.top = `${y - 30}px`;
                
                // Show animation
                focusIndicator.classList.add('focusing');
                
                // Play focus sound
                playSound('focus');
                
                // Remove after animation
                setTimeout(() => {
                    focusIndicator.classList.remove('focusing');
                    focusIndicator.classList.add('focused');
                    
                    setTimeout(() => {
                        focusIndicator.remove();
                    }, 1000);
                }, 1000);
            }
            
            // Focus camera at specific point
            function focusCamera(x, y) {
                if (!videoTrack) return;
                
                try {
                    const capabilities = videoTrack.getCapabilities();
                    
                    // Check if camera supports focus point
                    if (capabilities.focusMode && capabilities.focusMode.includes('manual') && capabilities.focusDistance) {
                        videoTrack.applyConstraints({
                            advanced: [
                                {
                                    focusMode: 'manual',
                                    focusDistance: 50, // Arbitrary value - would need real depth sensing
                                    pointsOfInterest: [{ x, y }]
                                }
                            ]
                        }).catch(e => console.log('Focus not supported:', e));
                    } else if (capabilities.focusMode && capabilities.focusMode.includes('single-shot')) {
                        // Fallback to auto focus
                        videoTrack.applyConstraints({
                            advanced: [
                                {
                                    focusMode: 'single-shot',
                                    pointsOfInterest: [{ x, y }]
                                }
                            ]
                        }).catch(e => console.log('Auto-focus not supported:', e));
                    }
                } catch (e) {
                    console.log('Focus control not supported:', e);
                }
            }
            
            // Apply mode-specific settings
            function applyModeSettings(mode) {
                if (!videoTrack) return;
                
                try {
                    const constraints = {};
                    
                    switch (mode) {
                        case 'photo':
                            // Standard photo mode - high resolution, balanced
                            constraints.whiteBalanceMode = 'auto';
                            constraints.exposureMode = 'auto';
                            break;
                            
                        case 'portrait':
                            // Portrait mode - shallow depth of field if possible
                            constraints.whiteBalanceMode = 'auto';
                            constraints.exposureMode = 'continuous';
                            // Aperture and focus settings would be here if supported
                            break;
                            
                        case 'night':
                            // Night mode - longer exposure time, higher ISO
                            constraints.whiteBalanceMode = 'auto';
                            constraints.exposureMode = 'manual';
                            constraints.exposureTime = 66666; // 1/15s if supported
                            constraints.iso = 1600; // Higher ISO if supported
                            break;
                            
                        case 'action':
                            // Action mode - faster shutter speed
                            constraints.whiteBalanceMode = 'auto';
                            constraints.exposureMode = 'manual';
                            constraints.exposureTime = 8333; // 1/120s if supported
                            break;
                            
                        case 'selfie':
                            // Switch to front camera if not already
                            if (facingMode !== 'user') {
                                facingMode = 'user';
                                stopCamera().then(() => {
                                    initCamera();
                                });
                                return;
                            }
                            // Selfie-specific settings
                            constraints.whiteBalanceMode = 'auto';
                            constraints.exposureMode = 'continuous';
                            break;
                    }
                    
                    // Apply constraints
                    videoTrack.applyConstraints({
                        advanced: [constraints]
                    }).catch(e => {
                        console.log(`Mode settings for ${mode} not fully supported:`, e);
                    });
                    
                } catch (e) {
                    console.log('Mode settings not supported:', e);
                }
            }
            
            // Render filtered gallery
            function renderFilteredGallery(filterType) {
                let filteredPhotos = [...savedPhotos];
                
                if (filterType === 'favorites') {
                    filteredPhotos = savedPhotos.filter(photo => photo.metadata && photo.metadata.favorite);
                } else if (filterType === 'paw') {
                    filteredPhotos = savedPhotos.filter(photo => photo.metadata && photo.metadata.pawMode);
                } else if (filterType !== 'all') {
                    // Filter by mode
                    filteredPhotos = savedPhotos.filter(photo => photo.mode === filterType);
                }
                
                // Re-render gallery with filtered photos
                photoGallery.innerHTML = '';
                
                if (filteredPhotos.length === 0) {
                    photoGallery.innerHTML = `
                        <div class="empty-filtered-gallery">
                            <i class="material-icons">photo_library</i>
                            <p>No ${filterType} photos</p>
                        </div>
                    `;
                    return;
                }
                
                // Create gallery grid
                const galleryGrid = document.createElement('div');
                galleryGrid.className = 'gallery-grid';
                
                // Add photos to grid
                filteredPhotos.forEach(photo => {
                    const photoItem = document.createElement('div');
                    photoItem.className = 'gallery-item';
                    photoItem.dataset.id = photo.id;
                    
                    photoItem.innerHTML = `
                        <img src="${photo.data}" alt="Pet photo">
                        <div class="gallery-item-overlay">
                            <div class="gallery-item-actions">
                                <button class="gallery-action view-photo" title="View">
                                    <i class="material-icons">visibility</i>
                                </button>
                                <button class="gallery-action share-photo" title="Share">
                                    <i class="material-icons">share</i>
                                </button>
                                <button class="gallery-action delete-photo" title="Delete">
                                    <i class="material-icons">delete</i>
                                </button>
                            </div>
                            <div class="gallery-item-info">
                                <span class="gallery-item-date">${formatDate(photo.timestamp)}</span>
                                <span class="gallery-item-mode">${modeTitles[photo.mode] || photo.mode}</span>
                            </div>
                        </div>
                    `;
                    
                    galleryGrid.appendChild(photoItem);
                    
                    // Add event listeners
                    const viewButton = photoItem.querySelector('.view-photo');
                    const shareButton = photoItem.querySelector('.share-photo');
                    const deleteButton = photoItem.querySelector('.delete-photo');
                    
                    viewButton.addEventListener('click', () => {
                        viewPhoto(photo.id);
                    });
                    
                    shareButton.addEventListener('click', () => {
                        sharePhoto(photo.data);
                    });
                    
                    deleteButton.addEventListener('click', () => {
                        deletePhoto(photo.id);
                    });
                });
                
                photoGallery.appendChild(galleryGrid);
            }
            
            // Check device capabilities and adjust UI
            function checkDeviceCapabilities() {
                if (!videoTrack) return;
                
                try {
                    const capabilities = videoTrack.getCapabilities();
                    
                    // Check for flash/torch capability
                    if (!capabilities.torch) {
                        flashToggleButton.classList.add('disabled');
                        flashToggleButton.setAttribute('title', 'Flash not available on this device');
                    } else {
                        flashToggleButton.classList.remove('disabled');
                    }
                    
                    // Check for zoom capability
                    if (!capabilities.zoom) {
                        document.querySelector('.zoom-control')?.classList.add('hidden');
                    }
                    
                    // Check for focus capability
                    if (!capabilities.focusMode || (!capabilities.focusMode.includes('manual') && !capabilities.focusMode.includes('single-shot'))) {
                        console.log('Focus tap not supported on this device');
                    }
                    
                    // Check exposure capability
                    if (!capabilities.exposureMode) {
                        exposureControl.parentElement?.classList.add('hidden');
                    }
                    
                    // Update resolution display 
                    updateResolutionDisplay();
                    
                } catch (e) {
                    console.log('Error checking capabilities:', e);
                }
            }
            
            // Battery level check
            function checkBatteryLevel() {
                if ('getBattery' in navigator) {
                    navigator.getBattery().then(battery => {
                        updateBatteryStatus(battery);
                        
                        // Listen for battery changes
                        battery.addEventListener('levelchange', () => {
                            updateBatteryStatus(battery);
                        });
                    });
                }
            }
            
            // Update battery status
            function updateBatteryStatus(battery) {
                const level = Math.floor(battery.level * 100);
                const batteryDisplay = document.querySelector('.battery-indicator');
                
                if (batteryDisplay) {
                    batteryDisplay.textContent = `${level}%`;
                    
                    // Show warning if battery is low
                    if (level < 20 && !battery.charging) {
                        showNotification('Battery level low. Consider saving your photos.', 'warning');
                        batteryDisplay.classList.add('low-battery');
                    } else {
                        batteryDisplay.classList.remove('low-battery');
                    }
                }
            }
            
            // Memory usage warning
            function checkMemoryUsage() {
                // Check localStorage size
                const totalSize = new Blob([localStorage.getItem('pawShotPhotos') || '']).size;
                const maxSize = 5 * 1024 * 1024; // 5MB limit
                
                if (totalSize > maxSize * 0.8) {
                    showNotification('Gallery storage is nearly full. Consider exporting your photos.', 'warning');
                }
            }
            
            // Initialize the app on load
            window.addEventListener('DOMContentLoaded', () => {
                // Show splash screen
                splashScreen.classList.remove('hidden');
                
                // Start app initialization
                setTimeout(() => {
                    initApp();
                    
                    // Check device capabilities after camera is initialized
                    setTimeout(() => {
                        checkDeviceCapabilities();
                        checkBatteryLevel();
                        checkMemoryUsage();
                    }, 1000);
                }, 2000); // Splash screen display duration
            });
            
            // Handle errors
            window.addEventListener('error', (event) => {
                console.error('Application error:', event.error);
                showNotification('Something went wrong. Please try again.', 'error');
            });
            
            // Handle visibility change
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // Resume camera if needed
                    if (!stream) {
                        initCamera();
                    }
                } else {
                    // Optionally pause camera when tab is hidden
                    // stopCamera();
                }
            });
            
            // Export functions for testing
            if (typeof module !== 'undefined' && module.exports) {
                module.exports = {
                    capturePhoto,
                    applyFilter: applyFilterToCanvas,
                    savePhotoToGallery,
                    renderGallery
                };
            }
            
