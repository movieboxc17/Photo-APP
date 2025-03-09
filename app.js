// PawShot - Advanced Pet Photography App
// Global variables
let videoStream = null;
let videoTrack = null;
let viewfinder = null;
let canvas = null;
let facingMode = 'environment'; // Start with back camera
let currentMode = 'normal'; // normal, portrait, night, action
let currentFilter = 'normal'; // normal, vivid, bw, sepia, etc.
let flashMode = 'off';
let savedPhotos = [];
let appSettings = {};
let isCapturing = false;
let burstModeActive = false;
let burstInterval = null;
let timerActive = false;
let timerCountdown = 0;
let timerInterval = null;
let stream = null;
let streamActive = false;
let deferredInstallPrompt = null;

// Mode titles for UI
const modeTitles = {
    normal: 'Normal',
    portrait: 'Portrait',
    night: 'Night',
    action: 'Action',
    selfie: 'Selfie',
    burst: 'Burst',
    paw: 'Paw Mode'
};

// Initialize camera
function initCamera() {
    // Get references to video and canvas elements
    viewfinder = document.getElementById('viewfinder');
    canvas = document.getElementById('canvas');
    
    if (!viewfinder || !canvas) {
        console.error('Viewfinder or canvas not found, creating them');
        createCameraElements();
    }
    
    // Set up canvas context
    const context = canvas.getContext('2d');
    
    // Reset any previous state
    if (videoStream) {
        stopCamera();
    }
    
    // Camera constraints
    const constraints = {
        video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
        },
        audio: false
    };
    
    // Request camera access
    navigator.mediaDevices.getUserMedia(constraints)
        .then(str => {
            videoStream = str;
            stream = str;
            streamActive = true;
            videoTrack = stream.getVideoTracks()[0];
            
            // Apply camera settings
            try {
                const capabilities = videoTrack.getCapabilities();
                const settings = {};
                
                // Set high quality settings if available
                if (capabilities.whiteBalanceMode) {
                    settings.whiteBalanceMode = 'continuous';
                }
                
                if (capabilities.exposureMode) {
                    settings.exposureMode = 'continuous';
                }
                
                if (capabilities.focusMode) {
                    settings.focusMode = 'continuous';
                }
                
                // Apply settings if we have any
                if (Object.keys(settings).length > 0) {
                    videoTrack.applyConstraints({ advanced: [settings] });
                }
            } catch (e) {
                console.log('Camera settings not supported:', e);
            }
            
            // Connect stream to video element
            viewfinder.srcObject = stream;
            viewfinder.play();
            
            // Size canvas after video loaded
            viewfinder.onloadedmetadata = () => {
                resizeCanvas();
                
                // Apply mode settings
                applyModeSettings(currentMode);
                
                // Show camera ready indicator
                showCameraReady();
            };
        })
        .catch(error => {
            console.error('Camera access error:', error);
            showNotification('Camera access denied', 'error');
        });
}

// Create required camera elements if not found
function createCameraElements() {
    // Create viewfinder if missing
    if (!viewfinder) {
        viewfinder = document.createElement('video');
        viewfinder.id = 'viewfinder';
        viewfinder.setAttribute('playsinline', '');
        viewfinder.setAttribute('autoplay', '');
        viewfinder.setAttribute('muted', '');
        
        // Create camera view if needed
        let cameraView = document.querySelector('.camera-view');
        if (!cameraView) {
            cameraView = document.createElement('div');
            cameraView.className = 'camera-view';
            document.body.appendChild(cameraView);
        }
        
        cameraView.appendChild(viewfinder);
    }
    
    // Create canvas if missing
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'canvas';
        
        // Hide canvas by default
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
    }
    
    // Create grid overlay if missing
    if (!document.querySelector('.grid-overlay')) {
        const gridOverlay = document.createElement('div');
        gridOverlay.className = 'grid-overlay';
        gridOverlay.innerHTML = `
            <div class="grid-line horizontal" style="top: 33.3%"></div>
            <div class="grid-line horizontal" style="top: 66.6%"></div>
            <div class="grid-line vertical" style="left: 33.3%"></div>
            <div class="grid-line vertical" style="left: 66.6%"></div>
        `;
        gridOverlay.style.display = 'none';
        
        const cameraView = document.querySelector('.camera-view');
        if (cameraView) {
            cameraView.appendChild(gridOverlay);
        } else {
            document.body.appendChild(gridOverlay);
        }
    }
    
    // Create essential controls if missing
    ensureControlsExist();
}

// Ensure all necessary camera controls exist
function ensureControlsExist() {
    // Create controls container if needed
    let cameraControls = document.querySelector('.camera-controls');
    if (!cameraControls) {
        cameraControls = document.createElement('div');
        cameraControls.className = 'camera-controls';
        
        const cameraView = document.querySelector('.camera-view');
        if (cameraView) {
            cameraView.appendChild(cameraControls);
        } else {
            document.body.appendChild(cameraControls);
        }
    }
    
    // Create capture button if missing
    if (!document.querySelector('.capture-button')) {
        const captureButton = document.createElement('div');
        captureButton.className = 'capture-button';
        captureButton.innerHTML = '<div class="capture-button-inner"></div>';
        cameraControls.appendChild(captureButton);
    }
    
    // Create mode switch if missing
    if (!document.querySelector('.mode-switch')) {
        const modeSwitch = document.createElement('div');
        modeSwitch.className = 'mode-switch';
        modeSwitch.innerHTML = `
            <div class="mode-switch-item active" data-mode="normal">Normal</div>
            <div class="mode-switch-item" data-mode="portrait">Portrait</div>
            <div class="mode-switch-item" data-mode="night">Night</div>
            <div class="mode-switch-item" data-mode="action">Action</div>
            <div class="mode-switch-item" data-mode="selfie">Selfie</div>
            <div class="mode-switch-item" data-mode="burst">Burst</div>
            <div class="mode-switch-item" data-mode="paw">Paw</div>
        `;
        cameraControls.appendChild(modeSwitch);
    }
    
    // Create filter options if missing
    if (!document.querySelector('.filter-options')) {
        const filterOptions = document.createElement('div');
        filterOptions.className = 'filter-options';
        filterOptions.innerHTML = `
            <div class="filter-option active" data-filter="normal">Normal</div>
            <div class="filter-option" data-filter="vivid">Vivid</div>
            <div class="filter-option" data-filter="bw">B&W</div>
            <div class="filter-option" data-filter="sepia">Sepia</div>
            <div class="filter-option" data-filter="vintage">Vintage</div>
            <div class="filter-option" data-filter="dramatic">Dramatic</div>
            <div class="filter-option" data-filter="noir">Noir</div>
            <div class="filter-option" data-filter="pawify">Pawify</div>
        `;
        cameraControls.appendChild(filterOptions);
    }
    
    // Create additional camera buttons if missing
    if (!document.querySelector('.camera-buttons')) {
        const cameraButtons = document.createElement('div');
        cameraButtons.className = 'camera-buttons';
        cameraButtons.innerHTML = `
            <button class="flash-toggle"><i class="material-icons">flash_off</i></button>
            <button class="timer-toggle"><span>Off</span></button>
            <button class="grid-toggle"><i class="material-icons">grid_on</i></button>
            <button class="camera-toggle"><i class="material-icons">camera_rear</i></button>
            <button class="settings-button"><i class="material-icons">settings</i></button>
            <button class="gallery-button"><i class="material-icons">photo_library</i><span class="gallery-count">0</span></button>
        `;
        cameraControls.appendChild(cameraButtons);
    }
    
    // Create gallery view if missing
    if (!document.querySelector('.gallery-view')) {
        const galleryView = document.createElement('div');
        galleryView.className = 'gallery-view hidden';
        galleryView.innerHTML = `
            <div class="gallery-header">
                <button class="back-to-camera"><i class="material-icons">arrow_back</i></button>
                <h2>Gallery</h2>
            </div>
            <div class="gallery-grid"></div>
        `;
        document.body.appendChild(galleryView);
    }
    
    // Create mode indicator if missing
    if (!document.querySelector('.mode-indicator')) {
        const modeIndicator = document.createElement('div');
        modeIndicator.className = 'mode-indicator';
        modeIndicator.textContent = 'Normal';
        
        const cameraView = document.querySelector('.camera-view');
        if (cameraView) {
            cameraView.appendChild(modeIndicator);
        } else {
            document.body.appendChild(modeIndicator);
        }
    }
}

// Resize canvas to match video dimensions
function resizeCanvas() {
    if (!viewfinder || !canvas) return;
    
    const videoWidth = viewfinder.videoWidth;
    const videoHeight = viewfinder.videoHeight;
    
    if (videoWidth && videoHeight) {
        // Adjust for device orientation
        const isLandscape = window.innerWidth > window.innerHeight;
        
        if (isLandscape) {
            canvas.width = Math.max(videoWidth, videoHeight);
            canvas.height = Math.min(videoWidth, videoHeight);
        } else {
            canvas.width = Math.min(videoWidth, videoHeight);
            canvas.height = Math.max(videoWidth, videoHeight);
        }
    } else {
        // Fallback if video dimensions not available
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}

// Stop camera stream
function stopCamera() {
    return new Promise((resolve) => {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
            videoTrack = null;
        }
        
        if (viewfinder) {
            viewfinder.srcObject = null;
        }
        
        resolve();
    });
}

// Show camera ready indicator
function showCameraReady() {
    const readyIndicator = document.createElement('div');
    readyIndicator.className = 'ready-indicator';
    readyIndicator.textContent = 'Camera Ready';
    
    document.body.appendChild(readyIndicator);
    
    // Add active class after a small delay for animation
    setTimeout(() => {
        readyIndicator.classList.add('active');
    }, 10);
    
    // Remove the indicator after animation
    setTimeout(() => {
        readyIndicator.classList.remove('active');
        setTimeout(() => {
            readyIndicator.remove();
        }, 300);
    }, 2000);
}

// Capture photo
function capturePhoto() {
    if (!viewfinder || !canvas || isCapturing) return;
    
    // Prevent multiple captures
    isCapturing = true;
    
    // If timer is active, don't capture immediately
    if (appSettings.timerDuration > 0 && !timerActive) {
        startTimer();
        return;
    }
    
    // Reset timer state
    timerActive = false;
    
    // Flash screen effect
    flashScreen();
    
    // Play shutter sound
    playSound('shutter');
    
    // Get canvas context
    const context = canvas.getContext('2d');
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate aspect ratios
    const videoRatio = viewfinder.videoWidth / viewfinder.videoHeight;
    const canvasRatio = canvas.width / canvas.height;
    
    let drawWidth, drawHeight, xOffset, yOffset;
    
    if (videoRatio > canvasRatio) {
        // Video is wider than canvas
        drawHeight = canvas.height;
        drawWidth = canvas.height * videoRatio;
        xOffset = (canvas.width - drawWidth) / 2;
        yOffset = 0;
    } else {
        // Video is taller than canvas
        drawWidth = canvas.width;
        drawHeight = canvas.width / videoRatio;
        xOffset = 0;
        yOffset = (canvas.height - drawHeight) / 2;
    }
    
    // Check if we need to flip for selfie mode
    if (facingMode === 'user') {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        
        // Adjust offsets for flipped video
        xOffset = drawWidth - canvas.width - xOffset;
    }
    
    // Draw video to canvas
    context.drawImage(viewfinder, xOffset, yOffset, drawWidth, drawHeight);
    
    // Reset transformation if we flipped
    if (facingMode === 'user') {
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
    
    // Process image based on mode
    processImage(context, canvas.width, canvas.height);
    
    // Get image data
    const photoData = canvas.toDataURL('image/jpeg', appSettings.highQuality ? 0.95 : 0.85);
    
    // Save to gallery
    savePhotoToGallery(photoData, currentMode);
    
    // Show photo preview
    showPhotoPreview(photoData);
    
        // Reset capture state after delay
        setTimeout(() => {
            isCapturing = false;
            
            // If in burst mode, continue capturing
            if (burstModeActive && currentMode === 'burst') {
                capturePhoto();
            }
        }, 500);
    }
    
    // Process image based on current mode
    function processImage(context, width, height) {
        // Apply selected filter
        if (currentFilter !== 'normal') {
            applyFilterToCanvas(context, width, height, currentFilter);
        }
        
        // Apply specific mode processing
        switch (currentMode) {
            case 'portrait':
                applyPortraitEffect(context, width, height);
                break;
                
            case 'night':
                applyNightEffect(context, width, height);
                break;
                
            case 'paw':
                applyPawOverlay(context, width, height);
                break;
                
            case 'dramatic':
                applyDramaticEffect(context, width, height);
                break;
        }
    }
    
    // Apply filter to canvas
    function applyFilterToCanvas(context, width, height, filter) {
        // Get image data
        const imageData = context.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Apply filter adjustments
        switch (filter) {
            case 'vivid':
                // Increase saturation and contrast
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Convert to HSL
                    const [h, s, l] = rgbToHsl(r, g, b);
                    
                    // Increase saturation and adjust lightness
                    const newS = Math.min(1, s * 1.3); // More saturated
                    const newL = l > 0.5 ? Math.min(1, l * 1.1) : Math.max(0, l * 0.9); // Increase contrast
                    
                    // Convert back to RGB
                    const [newR, newG, newB] = hslToRgb(h, newS, newL);
                    
                    data[i] = newR;
                    data[i + 1] = newG;
                    data[i + 2] = newB;
                }
                break;
                
            case 'bw':
                // Black and white
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Convert to grayscale with weighted channels for better BW conversion
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
                }
                break;
                
            case 'sepia':
                // Sepia tone
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;
                
            case 'vintage':
                // Vintage look with color shift and vignette
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Warm color shift
                    const newR = Math.min(255, r * 1.1);
                    const newG = Math.min(255, g * 0.9);
                    const newB = Math.min(255, b * 0.7);
                    
                    data[i] = newR;
                    data[i + 1] = newG;
                    data[i + 2] = newB;
                }
                
                // Add vignette
                addVignette(context, width, height, 0.7, 0.3);
                break;
                
            case 'dramatic':
                // High contrast, slightly desaturated
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Convert to HSL
                    const [h, s, l] = rgbToHsl(r, g, b);
                    
                    // Adjust for dramatic effect
                    const newS = Math.max(0, s * 0.85); // Slightly desaturated
                    const newL = l < 0.5 ? l * 0.7 : 0.5 + (l - 0.5) * 1.3; // Boost contrast
                    
                    // Convert back to RGB
                    const [newR, newG, newB] = hslToRgb(h, newS, newL);
                    
                    data[i] = newR;
                    data[i + 1] = newG;
                    data[i + 2] = newB;
                }
                break;
                
            case 'noir':
                // Film noir - high contrast black and white with grain
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // High contrast grayscale
                    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    // Boost contrast
                    gray = gray < 128 ? gray * 0.8 : 128 + (gray - 128) * 1.2;
                    
                    // Add subtle grain
                    const noise = (Math.random() - 0.5) * 15;
                    gray = Math.max(0, Math.min(255, gray + noise));
                    
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
                }
                break;
                
            case 'pawify':
                // More vibrant, pet-friendly colors
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // Convert to HSL
                    const [h, s, l] = rgbToHsl(r, g, b);
                    
                    // Enhance warm tones (good for pet fur)
                    let newH = h;
                    if (h > 0.05 && h < 0.17) {  // Yellow/orange/brown range
                        newH = h * 0.95;  // Slightly shift towards red
                    }
                    
                    // Boost saturation and adjust lightness
                    const newS = Math.min(1, s * 1.2);
                    const newL = l < 0.2 ? l * 1.1 : l;  // Brighten shadows
                    
                    // Convert back to RGB
                    const [newR, newG, newB] = hslToRgb(newH, newS, newL);
                    
                    data[i] = newR;
                    data[i + 1] = newG;
                    data[i + 2] = newB;
                }
                
                // Optional: add paw overlay
                applyPawOverlay(context, width, height, 0.1);
                break;
        }
        
        // Put the modified data back
        context.putImageData(imageData, 0, 0);
    }
    
    // Apply portrait mode effect (background blur)
    function applyPortraitEffect(context, width, height) {
        // Create a copy of the original image
        const originalData = context.getImageData(0, 0, width, height);
        
        // Create a blurred version for the background
        context.filter = 'blur(8px)';
        context.drawImage(canvas, 0, 0);
        const blurredData = context.getImageData(0, 0, width, height);
        
        // Reset filter
        context.filter = 'none';
        
        // Restore original image
        context.putImageData(originalData, 0, 0);
        
        // TODO: In a real app, we would use ML to detect pets/subjects
        // For this demo, we'll simulate a depth map with a radial gradient
        
        // Create a simulated depth map (centered oval)
        const centerX = width / 2;
        const centerY = height / 2;
        const maxDistance = Math.sqrt(Math.pow(width/2, 2) + Math.pow(height/2, 2)) * 0.6;
        
        const depthMap = context.createImageData(width, height);
        
        // Calculate depth values (0 = foreground, 255 = background)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2) * 1.5); // Oval shape
                const depth = Math.min(255, (distance / maxDistance) * 255);
                
                const index = (y * width + x) * 4;
                depthMap.data[index] = depth;
                depthMap.data[index + 1] = depth;
                depthMap.data[index + 2] = depth;
                depthMap.data[index + 3] = 255;
            }
        }
        
        // Blend original and blurred based on depth map
        const resultData = context.createImageData(width, height);
        for (let i = 0; i < originalData.data.length; i += 4) {
            const blendFactor = depthMap.data[i] / 255;
            
            resultData.data[i] = (1 - blendFactor) * originalData.data[i] + blendFactor * blurredData.data[i];
            resultData.data[i + 1] = (1 - blendFactor) * originalData.data[i + 1] + blendFactor * blurredData.data[i + 1];
            resultData.data[i + 2] = (1 - blendFactor) * originalData.data[i + 2] + blendFactor * blurredData.data[i + 2];
            resultData.data[i + 3] = 255;
        }
        
        // Put the result back
        context.putImageData(resultData, 0, 0);
    }
    
    // Apply night mode effect
    function applyNightEffect(context, width, height) {
        // Get image data
        const imageData = context.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Increase brightness, especially in dark areas
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate luminance
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Brighten dark areas more than bright areas
            const brightnessFactor = Math.max(1.2, 2 - (luminance / 128));
            
            data[i] = Math.min(255, r * brightnessFactor);
            data[i + 1] = Math.min(255, g * brightnessFactor);
            data[i + 2] = Math.min(255, b * brightnessFactor);
        }
        
        // Put the modified data back
        context.putImageData(imageData, 0, 0);
        
        // Add subtle noise to simulate night photography
        addNoise(context, width, height, 10);
        
        // Add a subtle blue tint
        addColorTint(context, width, height, 0, 0, 30, 0.2);
    }
    
    // Apply paw overlay
    function applyPawOverlay(context, width, height, opacity = 0.2) {
        // We'll add a paw print overlay in one corner
        const pawSize = Math.min(width, height) * 0.2;
        const pawX = width * 0.8;
        const pawY = height * 0.8;
        
        // Draw paw shape
        context.globalAlpha = opacity;
        context.fillStyle = '#fff';
        
        // Main pad
        context.beginPath();
        context.ellipse(pawX, pawY, pawSize / 2, pawSize / 2 * 0.8, 0, 0, Math.PI * 2);
        context.fill();
        
        // Toes
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI / 4) + (i * Math.PI / 6);
            const toeX = pawX + Math.cos(angle) * pawSize * 0.6;
            const toeY = pawY - Math.sin(angle) * pawSize * 0.6;
            
            context.beginPath();
            context.ellipse(toeX, toeY, pawSize / 4, pawSize / 4 * 0.8, angle, 0, Math.PI * 2);
            context.fill();
        }
        
        // Reset alpha
        context.globalAlpha = 1;
    }
    
    // Apply dramatic effect
    function applyDramaticEffect(context, width, height) {
        // Add a strong vignette
        addVignette(context, width, height, 0.8, 0.5);
        
        // Add a subtle cinematic color grade (teal/orange)
        const imageData = context.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Convert to HSL
            const [h, s, l] = rgbToHsl(r, g, b);
            
            // Adjust hue to push towards teal/orange
            let newH = h;
            if (h > 0.2 && h < 0.5) { // Push greens/cyans towards teal
                newH = 0.5;
            } else if (h > 0.05 && h < 0.2) { // Push yellows towards orange
                newH = 0.08;
            }
            
                    // Increase contrast
        const newL = l < 0.5 ? l * 0.8 : 0.5 + (l - 0.5) * 1.2;

        // Convert back to RGB
        const [newR, newG, newB] = hslToRgb(newH, s, newL);
        
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
    }
    
    // Put the modified data back
    context.putImageData(imageData, 0, 0);
}

// Add vignette effect
function addVignette(context, width, height, intensity = 0.5, size = 0.4) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2;
    
    // Create radial gradient
    const gradient = context.createRadialGradient(
        centerX, centerY, radius * size,
        centerX, centerY, radius
    );
    
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);
    
    // Draw vignette
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
}

// Add noise effect
function addNoise(context, width, height, intensity = 20) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * intensity;
        
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    
    context.putImageData(imageData, 0, 0);
}

// Add color tint
function addColorTint(context, width, height, r, g, b, strength = 0.3) {
    context.globalCompositeOperation = 'overlay';
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${strength})`;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
}

// Start timer countdown
function startTimer() {
    if (timerActive) return;
    
    timerActive = true;
    timerCountdown = appSettings.timerDuration;
    
    // Create countdown display
    const countdownEl = document.createElement('div');
    countdownEl.className = 'countdown-display';
    countdownEl.textContent = timerCountdown;
    document.body.appendChild(countdownEl);
    
    // Play start sound
    playSound('focus');
    
    // Start countdown
    timerInterval = setInterval(() => {
        timerCountdown--;
        
        if (timerCountdown > 0) {
            // Update display
            countdownEl.textContent = timerCountdown;
            
            // Play tick sound
            playSound('focus');
        } else {
            // Clear interval
            clearInterval(timerInterval);
            
            // Remove countdown display
            countdownEl.remove();
            
            // Take photo
            capturePhoto();
        }
    }, 1000);
}

// Flash screen effect
function flashScreen() {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    document.body.appendChild(flash);
    
    // Trigger animation
    setTimeout(() => {
        flash.classList.add('active');
        
        // Remove after animation
        setTimeout(() => {
            flash.remove();
        }, 300);
    }, 10);
}

// Start burst mode
function startBurstMode() {
    if (burstModeActive) return;
    
    burstModeActive = true;
    
    // Show burst indicator
    const burstIndicator = document.createElement('div');
    burstIndicator.className = 'burst-indicator';
    burstIndicator.textContent = 'BURST';
    document.body.appendChild(burstIndicator);
    
    // Capture first photo
    capturePhoto();
    
    // Set timeout to stop burst after a few seconds
    setTimeout(() => {
        stopBurstMode();
    }, 3000);
}

// Stop burst mode
function stopBurstMode() {
    burstModeActive = false;
    
    // Remove burst indicator
    const indicator = document.querySelector('.burst-indicator');
    if (indicator) indicator.remove();
    
    // Show notification
    showNotification('Burst captured!', 'success');
}

// Save photo to gallery
function savePhotoToGallery(photoData, mode) {
    // Create photo object
    const photo = {
        id: Date.now(), // Use timestamp as ID
        data: photoData,
        date: new Date().toISOString(),
        mode: mode,
        filter: currentFilter,
        favorite: false
    };
    
    // Add to saved photos array
    savedPhotos.push(photo);
    
    // Save to localStorage
    localStorage.setItem('pawShotGallery', JSON.stringify(savedPhotos));
    
    // Update gallery count
    updateGalleryCount();
    
    // Show success notification
    showNotification('Photo captured!', 'success');
    
    return photo;
}

// Update gallery count display
function updateGalleryCount() {
    const countElement = document.querySelector('.gallery-count');
    if (countElement) {
        countElement.textContent = savedPhotos.length;
    }
}

// Render gallery
function renderGallery() {
    const galleryGrid = document.querySelector('.gallery-grid');
    if (!galleryGrid) return;
    
    // Clear existing items
    galleryGrid.innerHTML = '';
    
    // If no photos, show empty state
    if (savedPhotos.length === 0) {
        galleryGrid.innerHTML = `
            <div class="empty-gallery">
                <i class="material-icons">photo_library</i>
                <p>No photos yet</p>
                <p>Capture some pet moments!</p>
            </div>
        `;
        return;
    }
    
    // Sort photos by date (newest first)
    const sortedPhotos = [...savedPhotos].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    
    // Create gallery items
    sortedPhotos.forEach(photo => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.dataset.id = photo.id;
        
        item.innerHTML = `
            <img src="${photo.data}" alt="Pet photo">
            <div class="gallery-item-overlay">
                <button class="favorite-button ${photo.favorite ? 'active' : ''}">
                    <i class="material-icons">${photo.favorite ? 'favorite' : 'favorite_border'}</i>
                </button>
                <button class="share-button">
                    <i class="material-icons">share</i>
                </button>
                <button class="delete-button">
                    <i class="material-icons">delete</i>
                </button>
            </div>
            <div class="photo-info">
                <span class="photo-date">${formatDate(photo.date)}</span>
                <span class="photo-mode">${modeTitles[photo.mode] || photo.mode}</span>
            </div>
        `;
        
        galleryGrid.appendChild(item);
        
        // Add event listeners
        const favoriteBtn = item.querySelector('.favorite-button');
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(photo.id);
            favoriteBtn.classList.toggle('active');
            favoriteBtn.querySelector('i').textContent = favoriteBtn.classList.contains('active') ? 'favorite' : 'favorite_border';
        });
        
        const shareBtn = item.querySelector('.share-button');
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sharePhoto(photo.data);
        });
        
        const deleteBtn = item.querySelector('.delete-button');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePhoto(photo.id);
            item.remove();
            
            // Check if gallery is now empty
            if (savedPhotos.length === 0) {
                renderGallery();
            }
        });
        
        // Open photo detail view when clicked
        item.addEventListener('click', () => {
            openPhotoDetail(photo);
        });
    });
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
                ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
}

// Toggle favorite status
function toggleFavorite(id) {
    const index = savedPhotos.findIndex(p => p.id === id);
    if (index !== -1) {
        savedPhotos[index].favorite = !savedPhotos[index].favorite;
        localStorage.setItem('pawShotGallery', JSON.stringify(savedPhotos));
    }
}

// Share photo
function sharePhoto(photoData) {
    if (navigator.share) {
        // Convert base64 to blob
        fetch(photoData)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], 'pawshot-photo.jpg', { type: 'image/jpeg' });
                
                navigator.share({
                    title: 'PawShot Photo',
                    text: 'Check out this pet photo I took with PawShot!',
                    files: [file]
                })
                .then(() => {
                    showNotification('Photo shared!', 'success');
                })
                .catch(error => {
                    console.log('Error sharing:', error);
                    showNotification('Could not share photo', 'error');
                });
            });
    } else {
        // Fallback for browsers without Web Share API
        showNotification('Sharing not supported on this browser', 'error');
        
        // Open in new tab as fallback
        const tab = window.open();
        tab.document.write(`<img src="${photoData}" alt="PawShot Photo" style="max-width: 100%; height: auto;">`);
        tab.document.title = 'PawShot Photo';
    }
}

// Delete photo
function deletePhoto(id) {
    // Confirm deletion
    if (confirm('Delete this photo?')) {
        const index = savedPhotos.findIndex(p => p.id === id);
        if (index !== -1) {
            savedPhotos.splice(index, 1);
            localStorage.setItem('pawShotGallery', JSON.stringify(savedPhotos));
            
            // Update gallery count
            updateGalleryCount();
            
            // Show notification
            showNotification('Photo deleted', 'success');
        }
    }
}

// Open photo detail view
function openPhotoDetail(photo) {
    // Create detail view overlay
    const detailView = document.createElement('div');
    detailView.className = 'photo-detail-view';
    
    detailView.innerHTML = `
        <div class="photo-detail-header">
            <button class="close-detail">
                <i class="material-icons">close</i>
            </button>
            <div class="photo-detail-actions">
                <button class="edit-photo">
                    <i class="material-icons">edit</i>
                </button>
                <button class="favorite-button ${photo.favorite ? 'active' : ''}">
                    <i class="material-icons">${photo.favorite ? 'favorite' : 'favorite_border'}</i>
                </button>
                <button class="share-photo">
                    <i class="material-icons">share</i>
                </button>
                <button class="delete-photo">
                    <i class="material-icons">delete</i>
                </button>
            </div>
        </div>
        <div class="photo-detail-content">
            <img src="${photo.data}" alt="Pet photo">
            <div class="photo-metadata">
                <div class="photo-date">${formatDate(photo.date)}</div>
                <div class="photo-mode">${modeTitles[photo.mode] || photo.mode}</div>
                <div class="photo-filter">${photo.filter.charAt(0).toUpperCase() + photo.filter.slice(1)} filter</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(detailView);
    
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
    
    // Add event listeners
    detailView.querySelector('.close-detail').addEventListener('click', () => {
        detailView.remove();
        document.body.style.overflow = '';
    });
    
    detailView.querySelector('.favorite-button').addEventListener('click', function() {
        toggleFavorite(photo.id);
        this.classList.toggle('active');
        this.querySelector('i').textContent = this.classList.contains('active') ? 'favorite' : 'favorite_border';
        
        // Update gallery view in background
        renderGallery();
    });
    
    detailView.querySelector('.share-photo').addEventListener('click', () => {
        sharePhoto(photo.data);
    });
    
    detailView.querySelector('.delete-photo').addEventListener('click', () => {
        deletePhoto(photo.id);
        detailView.remove();
        document.body.style.overflow = '';
        renderGallery();
    });
    
    detailView.querySelector('.edit-photo').addEventListener('click', () => {
        openPhotoEditor(photo);
        detailView.remove();
    });
}

// Open photo editor
function openPhotoEditor(photo) {
    // Create editor overlay
    const editorView = document.createElement('div');
    editorView.className = 'photo-editor-view';
    
    editorView.innerHTML = `
                <div class="editor-header">
            <button class="close-editor">
                <i class="material-icons">close</i>
            </button>
            <h2>Edit Photo</h2>
            <button class="save-edit">
                <i class="material-icons">check</i>
            </button>
        </div>
        <div class="editor-content">
            <canvas id="editor-canvas"></canvas>
            <div class="editor-controls">
                <div class="editor-control">
                    <label>Brightness</label>
                    <input type="range" min="-100" max="100" value="0" class="brightness-control">
                </div>
                <div class="editor-control">
                    <label>Contrast</label>
                    <input type="range" min="-100" max="100" value="0" class="contrast-control">
                </div>
                <div class="editor-control">
                    <label>Saturation</label>
                    <input type="range" min="-100" max="100" value="0" class="saturation-control">
                </div>
                <div class="editor-control">
                    <label>Warmth</label>
                    <input type="range" min="-100" max="100" value="0" class="warmth-control">
                </div>
                <div class="editor-filters">
                    <h3>Filters</h3>
                    <div class="filter-options">
                        <div class="filter-option active" data-filter="normal">Normal</div>
                        <div class="filter-option" data-filter="vivid">Vivid</div>
                        <div class="filter-option" data-filter="bw">B&W</div>
                        <div class="filter-option" data-filter="sepia">Sepia</div>
                        <div class="filter-option" data-filter="vintage">Vintage</div>
                        <div class="filter-option" data-filter="dramatic">Dramatic</div>
                        <div class="filter-option" data-filter="noir">Noir</div>
                        <div class="filter-option" data-filter="pawify">Pawify</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(editorView);
    
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
    
    // Set up editor canvas
    const editorCanvas = document.getElementById('editor-canvas');
    const ctx = editorCanvas.getContext('2d');
    
    // Load the image into the canvas
    const img = new Image();
    img.onload = function() {
        // Size canvas to fit image
        editorCanvas.width = img.width;
        editorCanvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Store original image data for resets
        const originalData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Initial filter and adjustments
        let currentFilter = 'normal';
        let adjustments = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            warmth: 0
        };
        
        // Apply filter and adjustments function
        function applyEdits() {
            // Reset to original image
            ctx.putImageData(originalData, 0, 0);
            
            // Apply adjustments
            applyAdjustments(ctx, editorCanvas.width, editorCanvas.height, adjustments);
            
            // Apply filter if not normal
            if (currentFilter !== 'normal') {
                applyFilterToCanvas(ctx, editorCanvas.width, editorCanvas.height, currentFilter);
            }
        }
        
        // Set up filter selection
        const filterOptions = editorView.querySelectorAll('.filter-option');
        filterOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Update UI
                filterOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                
                // Update current filter
                currentFilter = this.dataset.filter;
                
                // Apply edits
                applyEdits();
            });
        });
        
        // Set up adjustment sliders
        const brightnessControl = editorView.querySelector('.brightness-control');
        brightnessControl.addEventListener('input', function() {
            adjustments.brightness = parseInt(this.value);
            applyEdits();
        });
        
        const contrastControl = editorView.querySelector('.contrast-control');
        contrastControl.addEventListener('input', function() {
            adjustments.contrast = parseInt(this.value);
            applyEdits();
        });
        
        const saturationControl = editorView.querySelector('.saturation-control');
        saturationControl.addEventListener('input', function() {
            adjustments.saturation = parseInt(this.value);
            applyEdits();
        });
        
        const warmthControl = editorView.querySelector('.warmth-control');
        warmthControl.addEventListener('input', function() {
            adjustments.warmth = parseInt(this.value);
            applyEdits();
        });
    };
    img.src = photo.data;
    
    // Add event listeners
    editorView.querySelector('.close-editor').addEventListener('click', () => {
        editorView.remove();
        document.body.style.overflow = '';
    });
    
    editorView.querySelector('.save-edit').addEventListener('click', () => {
        // Get the edited image data
        const editedData = editorCanvas.toDataURL('image/jpeg', appSettings.highQuality ? 0.95 : 0.85);
        
        // Update the photo in the gallery
        const index = savedPhotos.findIndex(p => p.id === photo.id);
        if (index !== -1) {
            const updatedPhoto = { ...savedPhotos[index], data: editedData };
            savedPhotos[index] = updatedPhoto;
            localStorage.setItem('pawShotGallery', JSON.stringify(savedPhotos));
            
            // Show notification
            showNotification('Photo updated!', 'success');
            
            // Remove editor
            editorView.remove();
            document.body.style.overflow = '';
            
            // Refresh gallery
            renderGallery();
            
            // Open updated photo detail
            openPhotoDetail(updatedPhoto);
        }
    });
}

// Apply adjustments to canvas
function applyAdjustments(context, width, height, adjustments) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert to HSL for easier adjustments
        const [h, s, l] = rgbToHsl(r, g, b);
        
        // Apply brightness (affects lightness)
        const brightnessAdjust = adjustments.brightness / 200; // -0.5 to 0.5
        let newL = l + brightnessAdjust;
        
        // Apply contrast (affects distance from 0.5 lightness)
        const contrastFactor = 1 + adjustments.contrast / 100;
        newL = 0.5 + (newL - 0.5) * contrastFactor;
        
        // Apply saturation
        const saturationFactor = 1 + adjustments.saturation / 100;
        let newS = s * saturationFactor;
        
        // Ensure values are in valid range
        newL = Math.max(0, Math.min(1, newL));
        newS = Math.max(0, Math.min(1, newS));
        
        // Apply warmth (shift hue towards yellow or blue)
        let newH = h;
        if (adjustments.warmth !== 0) {
            const warmthShift = adjustments.warmth / 1000; // Small hue adjustments
            
            // For warm, shift reds and yellows more
            if (warmthShift > 0) {
                if (h > 0.5 && h < 0.75) { // Blues
                    newH = h - warmthShift * 0.5;
                } else {
                    newH = h - warmthShift;
                }
            } else {
                // For cool, shift towards blue
                if (h < 0.5 && h > 0.25) { // Yellows/greens
                    newH = h - warmthShift * 0.5;
                } else {
                    newH = h - warmthShift;
                }
            }
            
            // Keep hue in valid range
            if (newH < 0) newH += 1;
            if (newH > 1) newH -= 1;
        }
        
        // Convert back to RGB
        const [newR, newG, newB] = hslToRgb(newH, newS, newL);
        
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
    }
    
    context.putImageData(imageData, 0, 0);
}

// Show photo preview
function showPhotoPreview(photoData) {
    const preview = document.createElement('div');
    preview.className = 'photo-preview';
    preview.innerHTML = `
        <img src="${photoData}" alt="Captured photo">
        <div class="preview-actions">
            <button class="action-button retake-button">
                <i class="material-icons">replay</i>
                <span>Retake</span>
            </button>
            <button class="action-button save-button">
                <i class="material-icons">check</i>
                <span>Keep</span>
            </button>
        </div>
    `;
    
    document.body.appendChild(preview);
    
    // Add event listeners
    preview.querySelector('.retake-button').addEventListener('click', () => {
        // Delete the last photo
        const lastPhoto = savedPhotos.pop();
        localStorage.setItem('pawShotGallery', JSON.stringify(savedPhotos));
        
        // Update gallery count
        updateGalleryCount();
        
        // Remove preview
        preview.remove();
    });
    
    preview.querySelector('.save-button').addEventListener('click', () => {
        // Show saved confirmation
        showNotification('Photo saved to gallery!', 'success');
        
        // Remove preview
        preview.remove();
    });
    
    // Auto-remove preview after 5 seconds
    setTimeout(() => {
        if (document.body.contains(preview)) {
            preview.remove();
        }
    }, 5000);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Add icon based on type
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';
    
    notification.innerHTML = `
        <i class="material-icons">${icon}</i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Add active class after a small delay for animation
    setTimeout(() => {
        notification.classList.add('active');
    }, 10);
    
    // Remove the notification after animation
    setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// RGB to HSL conversion
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0; // achromatic
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
    
    return [h, s, l];
}

// HSL to RGB conversion
function hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l; // achromatic
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
        
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}

// Focus camera at specific point
function focusCamera(x, y) {
    if (!videoTrack) return;
    
    try {
        const capabilities = videoTrack.getCapabilities();
        
        // Check if manual focus is supported
        if (capabilities.focusMode && capabilities.focusMode.includes('manual')) {
            // Convert normalized coordinates to points
            const focusPoint = {
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y))
            };
            
            videoTrack.applyConstraints({
                advanced: [
                    {
                        focusMode: 'manual',
                        focusDistance: 0, // Close focus
                        pointsOfInterest: [focusPoint]
                    }
                ]
            });
            
            // Reset to continuous after a short time
            setTimeout(() => {
                videoTrack.applyConstraints({
                    advanced: [{
                        focusMode: 'continuous'
                    }]
                });
            }, 3000);
        }
    } catch (e) {
        console.log('Manual focus not supported:', e);
    }
}

// Show focus indicator
function showFocusIndicator(x, y) {
    const indicator = document.createElement('div');
    indicator.className = 'focus-indicator';
    indicator.style.left = `${x}px`;
    indicator.style.top = `${y}px`;
    
    document.body.appendChild(indicator);
    
    // Add active class after a small delay for animation
    setTimeout(() => {
        indicator.classList.add('active');
    }, 10);
    
    // Remove the indicator after animation
    setTimeout(() => {
        indicator.classList.remove('active');
        setTimeout(() => {
            indicator.remove();
        }, 300);
    }, 2000);
}

// Apply mode settings
function applyModeSettings(mode) {
    // Update mode indicator
    const modeIndicator = document.querySelector('.mode-indicator');
    if (modeIndicator) {
        modeIndicator.textContent = modeTitles[mode] || mode;
    }
    
    // Reset any active mode states
    if (burstModeActive) {
        stopBurstMode();
    }
    
    if (timerActive) {
        clearInterval(timerInterval);
        timerActive = false;
        
        const countdownEl = document.querySelector('.countdown-display');
        if (countdownEl) countdownEl.remove();
    }
    
    // Apply specific mode settings
    if (videoTrack) {
        try {
            const capabilities = videoTrack.getCapabilities();
            const settings = {};
            
            switch (mode) {
                case 'normal':
                    // Standard settings
                    if (capabilities.exposureMode) settings.exposureMode = 'continuous';
                    if (capabilities.whiteBalanceMode) settings.whiteBalanceMode = 'continuous';
                    break;
                    
                case 'portrait':
                    // Better for portraits with ideal exposure
                    if (capabilities.exposureMode) settings.exposureMode = 'continuous';
                    if (capabilities.exposureCompensation) settings.exposureCompensation = 0.3; // Slight overexposure for faces
                    break;
                    
                case 'night':
                    // Longer exposure for better night shots
                    if (capabilities.exposureMode) settings.exposureMode = 'manual';
                    if (capabilities.exposureTime) {
                        // Try to set a longer exposure time
                        const maxTime = capabilities.exposureTime.max;
                        settings.exposureTime = Math.min(maxTime, 0.25); // 1/4 second if possible
                    }
                    break;
                    
                case 'action':
                    // Faster shutter speed for moving subjects
                    if (capabilities.exposureMode) settings.exposureMode = 'manual';
                    if (capabilities.exposureTime) {
                        // Try to set a shorter exposure time
                        const minTime = capabilities.exposureTime.min;
                        settings.exposureTime = minTime; // Fastest possible
                    }
                    break;
                    
                case 'selfie':
                    // Change to front camera if we're not already using it
                    if (facingMode !== 'user') {
                        // Stop current camera and switch to front
                        facingMode = 'user';
                        stopCamera().then(() => initCamera());
                        return;
                    }
                    break;
                    
                case 'burst':
                    // Will activate burst mode when taking photos
                    // Just set standard settings for now
                    if (capabilities.exposureMode) settings.exposureMode = 'continuous';
                    break;
                    
                case 'paw':
                    // Standard settings, special paw effect added during processing
                    if (capabilities.exposureMode) settings.exposureMode = 'continuous';
                    if (capabilities.whiteBalanceMode) settings.whiteBalanceMode = 'continuous';
                    break;
            }
            
            // Apply settings if we have any
            if (Object.keys(settings).length > 0) {
                videoTrack.applyConstraints({ advanced: [settings] });
            }
        } catch (e) {
            console.log('Mode settings not supported:', e);
        }
    }
}

// Switch camera
function toggleCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    stopCamera().then(() => initCamera());
}

// Toggle flash mode
function toggleFlash() {
    if (!videoTrack) return;
    
    // Cycle through flash modes
    const modes = ['off', 'on', 'auto'];
    const currentIndex = modes.indexOf(flashMode);
    flashMode = modes[(currentIndex + 1) % modes.length];
    
    try {
        // Apply flash settings if supported
        const capabilities = videoTrack.getCapabilities();
        if (capabilities.torch) {
            videoTrack.applyConstraints({
                advanced: [{ torch: flashMode === 'on' }]
            });
        }
    } catch (e) {
        console.log('Flash not supported:', e);
    }
    
    // Update flash button UI
    const flashButton = document.querySelector('.flash-toggle i');
    if (flashButton) {
        let iconName = 'flash_off';
        if (flashMode === 'on') iconName = 'flash_on';
        if (flashMode === 'auto') iconName = 'flash_auto';
        
        flashButton.textContent = iconName;
    }
}

// Toggle grid overlay
function toggleGrid() {
    const gridOverlay = document.querySelector('.grid-overlay');
    if (gridOverlay) {
        const isVisible = gridOverlay.style.display !== 'none';
        gridOverlay.style.display = isVisible ? 'none' : 'block';
        
        // Update grid button
        const gridButton = document.querySelector('.grid-toggle i');
        if (gridButton) {
            gridButton.textContent = isVisible ? 'grid_on' : 'grid_off';
        }
    }
}

// Toggle timer
function toggleTimer() {
    // Cycle through options: off, 3s, 5s, 10s
    const timerOptions = [0, 3, 5, 10];
    const currentIndex = timerOptions.indexOf(appSettings.timerDuration);
    appSettings.timerDuration = timerOptions[(currentIndex + 1) % timerOptions.length];
    
    // Save settings
    localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
    
    // Update timer button
    const timerButton = document.querySelector('.timer-toggle span');
    if (timerButton) {
        timerButton.textContent = appSettings.timerDuration === 0 ? 'Off' : `${appSettings.timerDuration}s`;
    }
}

// Open settings
function openSettings() {
    // Create settings overlay
    const settingsView = document.createElement('div');
    settingsView.className = 'settings-view';
    
    settingsView.innerHTML = `
        <div class="settings-header">
            <button class="close-settings">
                <i class="material-icons">close</i>
            </button>
            <h2>Settings</h2>
        </div>
        <div class="settings-content">
            <div class="settings-section">
                <h3>Camera</h3>
                <div class="setting-item">
                    <label>High quality photos</label>
                    <label class="switch">
                        <input type="checkbox" class="quality-toggle" ${appSettings.highQuality ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <label>Save location data</label>
                    <label class="switch">
                        <input type="checkbox" class="location-toggle" ${appSettings.saveLocation ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="setting-item">
                    <label>Camera sounds</label>
                    <label class="switch">
                        <input type="checkbox" class="sounds-toggle" ${appSettings.cameraSounds ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </div>
            <div class="settings-section">
                <h3>About</h3>
                <div class="about-info">
                    <p>PawShot v1.0</p>
                    <p>The ultimate pet photography app</p>
                    <p>© 2023 PawShot</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(settingsView);
    
    // Add event listeners
    settingsView.querySelector('.close-settings').addEventListener('click', () => {
        settingsView.remove();
    });
    
    settingsView.querySelector('.quality-toggle').addEventListener('change', function() {
        appSettings.highQuality = this.checked;
        localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
    });
    
    settingsView.querySelector('.location-toggle').addEventListener('change', function() {
        appSettings.saveLocation = this.checked;
        localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
    });
    
    settingsView.querySelector('.sounds-toggle').addEventListener('change', function() {
        appSettings.cameraSounds = this.checked;
        localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
    });
}

// Play camera sound
function playSound(type) {
    if (!appSettings.cameraSounds) return;
    
    let sound;
    switch (type) {
        case 'shutter':
            sound = new Audio('sounds/shutter.mp3');
            break;
        case 'focus':
            sound = new Audio('sounds/focus.mp3');
            break;
        case 'success':
            sound = new Audio('sounds/success.mp3');
            break;
    }
    
    if (sound) {
        sound.play().catch(e => {
            console.log('Sound playback error:', e);
        });
    }
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
            .catch(e => {
                console.log('Fullscreen error:', e);
                showNotification('Fullscreen not available', 'error');
            });
    } else {
        document.exitFullscreen();
    }
}

// Load app settings from storage
function loadSettings() {
    const savedSettings = localStorage.getItem('pawShotSettings');
    if (savedSettings) {
        appSettings = JSON.parse(savedSettings);
    } else {
        // Default settings
        appSettings = {
            highQuality: true,
            saveLocation: false,
            cameraSounds: true,
            timerDuration: 0,
            defaultMode: 'normal',
            defaultFilter: 'normal',
            darkMode: false
        };
        localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
    }
    
    // Load photos from storage
    const savedGallery = localStorage.getItem('pawShotGallery');
    if (savedGallery) {
        savedPhotos = JSON.parse(savedGallery);
    }
}

// Initialize app
function initApp() {
    // Hide splash screen and show app container after loading
    setTimeout(() => {
        const splashScreen = document.getElementById('splash-screen');
        const appContainer = document.getElementById('app-container');
        
        if (splashScreen && appContainer) {
            // Show app container first (but still invisible due to opacity)
            appContainer.style.display = '';
            
            // Add the show class for the transition
            setTimeout(() => {
                appContainer.classList.add('show');
                
                // Hide splash screen after app container transition starts
                setTimeout(() => {
                    splashScreen.style.display = 'none';
                }, 100);
            }, 50);
        }
    }, 2000); // Wait for animation to complete
    
    // Load settings
    loadSettings();
    
    // Set up camera
    initCamera();
    
    // Update gallery count
    updateGalleryCount();
    
    // Add event listeners
    setupEventListeners();
    
    // Update timer button
    const timerButton = document.querySelector('.timer-toggle span');
    if (timerButton) {
        timerButton.textContent = appSettings.timerDuration === 0 ? 'Off' : `${appSettings.timerDuration}s`;
    }
}

// Set up event listeners
function setupEventListeners() {
    try {
        // Capture button
        const captureButton = document.querySelector('.capture-button');
        if (captureButton) {
            captureButton.addEventListener('click', () => {
                if (currentMode === 'burst') {
                    startBurstMode();
                } else {
                    capturePhoto();
                }
            });
        }
        
        // Camera toggle
        const cameraToggle = document.querySelector('.camera-toggle');
        if (cameraToggle) {
            cameraToggle.addEventListener('click', toggleCamera);
        }
        
        // Flash toggle
        const flashToggle = document.querySelector('.flash-toggle');
        if (flashToggle) {
            flashToggle.addEventListener('click', toggleFlash);
        }
        
        // Grid toggle
        const gridToggle = document.querySelector('.grid-toggle');
        if (gridToggle) {
            gridToggle.addEventListener('click', toggleGrid);
        }
        
        // Timer toggle
        const timerToggle = document.querySelector('.timer-toggle');
        if (timerToggle) {
            timerToggle.addEventListener('click', toggleTimer);
        }
        
        // Gallery button
        const galleryButton = document.querySelector('.gallery-button');
        if (galleryButton) {
            galleryButton.addEventListener('click', () => {
                // Show gallery view
                const galleryView = document.querySelector('.gallery-view');
                if (galleryView) {
                    galleryView.classList.remove('hidden');
                    
                    // Render gallery
                    renderGallery();
                }
            });
        }
        
        // Back to camera button
        const backButton = document.querySelector('.back-to-camera');
        if (backButton) {
            backButton.addEventListener('click', () => {
                // Hide gallery view
                const galleryView = document.querySelector('.gallery-view');
                if (galleryView) {
                    galleryView.classList.add('hidden');
                }
            });
        }
        
        // Settings button
        const settingsButton = document.querySelector('.settings-button');
        if (settingsButton) {
            settingsButton.addEventListener('click', openSettings);
        }
        
        // Mode switches
        const modeOptions = document.querySelectorAll('.mode-switch-item');
        modeOptions.forEach(option => {
            option.addEventListener('click', function() {
                // Update UI
                modeOptions.forEach(opt => opt.classList.remove('active'));
                this.classList.add('active');
                
                // Update current mode
                currentMode = this.dataset.mode;
                
                // Apply mode settings
                applyModeSettings(currentMode);
            });
        });
        
                // Filter options
                const filterOptions = document.querySelectorAll('.filter-option');
                filterOptions.forEach(option => {
                    option.addEventListener('click', function() {
                        // Update UI
                        filterOptions.forEach(opt => opt.classList.remove('active'));
                        this.classList.add('active');
                        
                        // Update current filter
                        currentFilter = this.dataset.filter;
                    });
                });
                
                // Focus on tap
                const cameraView = document.querySelector('.camera-view');
                if (cameraView) {
                    cameraView.addEventListener('click', function(e) {
                        if (!viewfinder) return;
                        
                        // Calculate relative position
                        const viewfinderRect = viewfinder.getBoundingClientRect();
                        const x = (e.clientX - viewfinderRect.left) / viewfinderRect.width;
                        const y = (e.clientY - viewfinderRect.top) / viewfinderRect.height;
                        
                        // Focus camera at this point
                        focusCamera(x, y);
                        
                        // Show focus indicator
                        showFocusIndicator(e.clientX, e.clientY);
                    });
                }
                
                // Window resize handler
                window.addEventListener('resize', resizeCanvas);
                
                // Orientation change handler
                window.addEventListener('orientationchange', () => {
                    // Delay resize slightly to account for transition
                    setTimeout(resizeCanvas, 300);
                });
                
                // Handle keyboard shortcuts
                document.addEventListener('keydown', function(e) {
                    // Space bar = capture photo
                    if (e.code === 'Space') {
                        if (currentMode === 'burst') {
                            startBurstMode();
                        } else {
                            capturePhoto();
                        }
                    }
                    
                    // 'F' toggle flash
                    if (e.code === 'KeyF') {
                        toggleFlash();
                    }
                    
                    // 'G' toggle grid
                    if (e.code === 'KeyG') {
                        toggleGrid();
                    }
                    
                    // 'T' toggle timer
                    if (e.code === 'KeyT') {
                        toggleTimer();
                    }
                    
                    // 'C' toggle camera
                    if (e.code === 'KeyC') {
                        toggleCamera();
                    }
                });
                
                // Check if the app is installed as PWA
                window.addEventListener('beforeinstallprompt', (e) => {
                    // Prevent Chrome 76+ from automatically showing the prompt
                    e.preventDefault();
                    
                    // Stash the event so it can be triggered later
                    deferredInstallPrompt = e;
                    
                    // Show install button if available
                    const installButton = document.querySelector('.install-app');
                    if (installButton) {
                        installButton.classList.remove('hidden');
                        installButton.addEventListener('click', () => {
                            // Show the install prompt
                            deferredInstallPrompt.prompt();
                            
                            // Wait for the user to respond to the prompt
                            deferredInstallPrompt.userChoice.then((choiceResult) => {
                                if (choiceResult.outcome === 'accepted') {
                                    console.log('User accepted the install prompt');
                                    showNotification('App installation started', 'success');
                                } else {
                                    console.log('User dismissed the install prompt');
                                }
                                
                                // Clear the saved prompt since it can't be used again
                                deferredInstallPrompt = null;
                                
                                // Hide install button
                                installButton.classList.add('hidden');
                            });
                        });
                    }
                });
                
                // Hide the address bar on mobile
                window.addEventListener('load', function() {
                    setTimeout(function() {
                        window.scrollTo(0, 1);
                    }, 100);
                });
                
                // Handle visibility change to restart camera if needed
                document.addEventListener('visibilitychange', function() {
                    if (document.visibilityState === 'visible' && !videoStream && viewfinder) {
                        // Restart camera if it was stopped
                        initCamera();
                    }
                    
                    if (document.visibilityState === 'hidden' && videoStream) {
                        // Optionally stop camera to save battery
                        if (appSettings.saveOnBattery) {
                            stopCamera();
                        }
                    }
                });
            } catch (e) {
                console.error('Error setting up event listeners:', e);
                showNotification('Error initializing app', 'error');
            }
        }
        
        // Register service worker for PWA
        function registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/service-worker.js')
                        .then(registration => {
                            console.log('ServiceWorker registered with scope:', registration.scope);
                        })
                        .catch(error => {
                            console.log('ServiceWorker registration failed:', error);
                        });
                });
            }
        }
        
        // Check for app updates
        function checkForUpdates() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.update();
                });
                
                // Listen for controlling service worker changing
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (refreshing) return;
                    refreshing = true;
                    
                    // Show update notification
                    showNotification('App updated! Refreshing...', 'success');
                    
                    // Reload the page
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                });
            }
        }
        
        // Initialize app when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            initApp();
            registerServiceWorker();
        });
        
        // Check for updates periodically
        setInterval(checkForUpdates, 60 * 60 * 1000); // Check every hour
