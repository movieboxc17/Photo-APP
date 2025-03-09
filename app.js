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

// Initialize app with splash screen
function initApp() {
    // Show splash screen animation
    const loadingProgress = document.querySelector('.loading-progress');
    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress += 5;
        loadingProgress.style.width = `${progress}%`;
        
        if (progress >= 100) {
            clearInterval(loadingInterval);
            
            // Add a slight delay before showing the app
            setTimeout(() => {
                splashScreen.style.opacity = 0;
                appContainer.style.display = 'flex';
                
                // Trigger the entrance animation
                setTimeout(() => {
                    appContainer.classList.add('show');
                    splashScreen.style.display = 'none';
                }, 500);
                
                // Initialize camera and other components
                initializeAppComponents();
            }, 500);
        }
    }, 50);
}

// Initialize all app components
function initializeAppComponents() {
    // Check for camera permissions
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification('Your browser does not support camera access. Please try a different browser.', 'error');
        return;
    }
    
    // Initialize UI
    initUI();
    
    // Initialize camera
    initCamera();
    
    // Initialize settings
    loadSettings();
    
    // Initialize gallery
    renderGallery();
    
    // Initialize device orientation if available
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation);
    }
    
    // Initialize service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered with scope:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    }
    
    // Update status bar time
    updateStatusBarTime();
    setInterval(updateStatusBarTime, 60000);
}

// Initialize UI elements
function initUI() {
    // Set initial filter effect
    filterEffects[0].style.boxShadow = '0 0 0 2px white, 0 4px 8px rgba(0,0,0,0.3)';
    
    // Update resolution display
    updateResolutionDisplay();
    
    // Add event listeners for UI controls
    setupEventListeners();
}

// Update status bar time
function updateStatusBarTime() {
    const statusLeft = document.querySelector('.status-left');
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    statusLeft.textContent = `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
}

// Set up event listeners
function setupEventListeners() {
    // Camera controls
    shutterButton.addEventListener('click', takePhoto);
    
    switchCameraButton.addEventListener('click', () => {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        initCamera();
    });
    
    togglePawModeButton.addEventListener('click', togglePawMode);
    
    flashToggleButton.addEventListener('click', toggleFlash);
    
    hdrToggleButton.addEventListener('click', toggleHDR);
    
    timerToggleButton.addEventListener('click', toggleTimer);
    
    gridToggleButton.addEventListener('click', toggleGrid);
    
    // Mode options
    modeOptions.forEach(option => {
        option.addEventListener('click', function() {
            modeOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            currentMode = this.dataset.mode;
            updateModeIndicators();
        });
    });
    
    // Filter effects
    filterEffects.forEach(filter => {
        filter.addEventListener('click', function() {
            currentFilter = this.dataset.filter;
            
            // Apply visual feedback
            filterEffects.forEach(f => f.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)');
            this.style.boxShadow = '0 0 0 2px white, 0 4px 8px rgba(0,0,0,0.3)';
            
            // Apply live filter to viewfinder
            viewfinder.style.filter = getFilterStyle(currentFilter);
        });
    });
    
    // Exposure control
    exposureControl.addEventListener('input', function() {
        exposureCompensation = Number(this.value);
        applyExposureCompensation();
    });
    
    // Navigation
    galleryButton.addEventListener('click', () => {
        cameraScreen.classList.remove('active');
        galleryScreen.classList.add('active');
        renderGallery();
    });
    
    backToCameraButton.addEventListener('click', () => {
        galleryScreen.classList.remove('active');
        cameraScreen.classList.add('active');
    });
    
    document.getElementById('back-to-gallery').addEventListener('click', () => {
        editScreen.classList.remove('active');
        galleryScreen.classList.add('active');
    });
    
    document.getElementById('save-edit').addEventListener('click', saveEdit);
    
    settingsButton.addEventListener('click', () => {
        cameraScreen.classList.remove('active');
        settingsScreen.classList.add('active');
    });
    
    backToSettingsButton.addEventListener('click', () => {
        settingsScreen.classList.remove('active');
        cameraScreen.classList.add('active');
    });
    
    // Gallery tabs
    galleryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            galleryTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const tabType = this.dataset.tab;
            filterGallery(tabType);
        });
    });
    
    // Settings
    qualitySetting.addEventListener('change', function() {
        qualityLevel = this.value;
        updateResolutionDisplay();
        saveSettings();
    });
    
    stackFramesSetting.addEventListener('change', function() {
        stackFrameCount = parseInt(this.value);
        saveSettings();
    });
    
    superResToggle.addEventListener('change', function() {
        isSuperResEnabled = this.checked;
        saveSettings();
    });
    
    // Touch interaction for focus and exposure
    setupTouchInteractions();
}

// Set up touch interactions
function setupTouchInteractions() {
    let touchStartTime;
    let longPressTimeout;
    let exposureSlider = document.querySelector('.exposure-slider');
    
    viewfinder.parentElement.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        
        // Check for long press to adjust exposure
        longPressTimeout = setTimeout(() => {
            exposureSlider.classList.add('active');
            // Prevent default to avoid triggering focus
            e.preventDefault();
        }, 600);
        
        // Show focus indicator
        const focusIndicator = document.querySelector('.focus-indicator');
        focusIndicator.style.left = e.touches[0].clientX + 'px';
        focusIndicator.style.top = e.touches[0].clientY + 'px';
        focusIndicator.style.opacity = '1';
        
        setTimeout(() => {
            focusIndicator.style.transform = 'translate(-50%, -50%) scale(0.7)';
        }, 100);
    });
    
    viewfinder.parentElement.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimeout);
        
        const touchDuration = Date.now() - touchStartTime;
        
        // Reset focus indicator
        const focusIndicator = document.querySelector('.focus-indicator');
        focusIndicator.style.transform = 'translate(-50%, -50%) scale(1)';
        setTimeout(() => {
            focusIndicator.style.opacity = '0';
        }, 300);
        
        // Hide exposure slider if it was shown
        setTimeout(() => {
            exposureSlider.classList.remove('active');
        }, 2000);
        
        // If it wasn't a long press, set focus point
        if (touchDuration < 600) {
            setFocusPoint(e);
        }
    });
}

// Initialize camera
function initCamera() {
    if (stream) {
        // Stop all tracks from previous stream
        stream.getTracks().forEach(track => track.stop());
    }
    
    // Get ideal resolution based on quality setting
    const idealResolution = getIdealResolution();
    
    const constraints = {
        audio: false,
        video: {
            facingMode: facingMode,
            width: { ideal: idealResolution.width },
            height: { ideal: idealResolution.height }
        }
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
        .then(mediaStream => {
            stream = mediaStream;
            viewfinder.srcObject = stream;
            
            // Apply current filter
            viewfinder.style.filter = getFilterStyle(currentFilter);
            
            // Once video is playing, update UI with camera capabilities
            viewfinder.onloadedmetadata = () => {
                updateCameraCapabilities();
            };
        })
        .catch(error => {
            console.error('Error accessing camera:', error);
            showNotification('Camera access denied. Please grant permission to use this app.', 'error');
        });
}

// Get ideal resolution based on quality settings
function getIdealResolution() {
    switch (qualityLevel) {
        case 'ultra':
            return { width: 3840, height: 2160 }; // 4K
        case 'max':
            return { width: 7680, height: 4320 }; // 8K
        case 'high':
        default:
            return { width: 1920, height: 1080 }; // 1080p
    }
}

// Update resolution display
function updateResolutionDisplay() {
    let megapixels;
    switch (qualityLevel) {
        case 'high':
            megapixels = '12 MP';
            break;
        case 'ultra':
            megapixels = '24 MP';
            break;
        case 'max':
            megapixels = '48 MP';
            break;
        default:
            megapixels = '12 MP';
    }
    resolutionDisplay.textContent = megapixels;
}

// Update camera capabilities
function updateCameraCapabilities() {
    if (!stream) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    
    if (videoTrack && videoTrack.getCapabilities) {
        const capabilities = videoTrack.getCapabilities();
        
        // Update Flash button visibility based on torch capability
        if (capabilities.torch === undefined) {
            flashToggleButton.style.opacity = '0.5';
            flashToggleButton.dataset.tooltip = 'Flash not available';
        } else {
            flashToggleButton.style.opacity = '1';
            flashToggleButton.dataset.tooltip = 'Flash';
        }
        
        // Check for exposure capability
        if (capabilities.exposureCompensation) {
            exposureControl.min = capabilities.exposureCompensation.min;
            exposureControl.max = capabilities.exposureCompensation.max;
            exposureControl.step = capabilities.exposureCompensation.step;
            exposureControl.value = 0; // Reset to default
        }
    }
}

// Apply exposure compensation
function applyExposureCompensation() {
    if (!stream) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    
    if (videoTrack && videoTrack.getCapabilities) {
        const capabilities = videoTrack.getCapabilities();
        
        if (capabilities.exposureCompensation) {
            try {
                videoTrack.applyConstraints({
                    advanced: [{ exposureCompensation: exposureCompensation }]
                });
            } catch (error) {
                console.error('Error setting exposure:', error);
            }
        }
    }
}

// Set focus point
function setFocusPoint(event) {
    if (!stream) return;
    
    const videoTrack = stream.getVideoTracks()[0];
    
    if (videoTrack && videoTrack.getCapabilities) {
        const capabilities = videoTrack.getCapabilities();
        
        if (capabilities.focusMode && capabilities.focusMode.includes('manual')) {
            try {
                // Convert touch position to normalized coordinates
                const viewfinderRect = viewfinder.getBoundingClientRect();
                const touchX = event.changedTouches[0].clientX;
                const touchY = event.changedTouches[0].clientY;
                
                const normalizedX = (touchX - viewfinderRect.left) / viewfinderRect.width;
                const normalizedY = (touchY - viewfinderRect.top) / viewfinderRect.height;
                
                videoTrack.applyConstraints({
                    advanced: [{
                        focusMode: 'manual',
                        pointsOfInterest: [{ x: normalizedX, y: normalizedY }]
                    }]
                });
            } catch (error) {
                console.error('Error setting focus point:', error);
            }
        }
    }
}

    // Toggle paw mode
    function togglePawMode() {
        isPawMode = !isPawMode;
        
        if (isPawMode) {
            document.body.classList.add('paw-mode');
            togglePawModeButton.style.backgroundColor = 'var(--secondary-color)';
            viewfinder.style.filter = getFilterStyle('pawify');
            
            // Display paw prints on screen with random animation
            createRandomPawPrints();
            
            // Show notification
            showNotification('Paw Mode activated! 🐾', 'success');
        } else {
            document.body.classList.remove('paw-mode');
            togglePawModeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            viewfinder.style.filter = getFilterStyle(currentFilter);
            
            // Remove paw prints
            document.querySelectorAll('.paw-print').forEach(paw => paw.remove());
        }
    }
    
    // Create random paw prints on screen
    function createRandomPawPrints() {
        const container = viewfinder.parentElement;
        const pawCount = 5;
        
        for (let i = 0; i < pawCount; i++) {
            const pawPrint = document.createElement('div');
            pawPrint.className = 'paw-print';
            
            // Random position
            const randomX = Math.random() * container.offsetWidth;
            const randomY = Math.random() * container.offsetHeight;
            
            pawPrint.style.left = `${randomX}px`;
            pawPrint.style.top = `${randomY}px`;
            
            // Random rotation
            const rotation = Math.random() * 360;
            pawPrint.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
            
            // Add to DOM with fade-in
            container.appendChild(pawPrint);
            setTimeout(() => {
                pawPrint.style.opacity = '0.6';
            }, i * 100);
            
            // Remove after animation
            setTimeout(() => {
                pawPrint.style.opacity = '0';
                setTimeout(() => pawPrint.remove(), 500);
            }, 3000 + i * 500);
        }
    }
    
    // Toggle flash mode
    function toggleFlash() {
        const flashModes = ['off', 'auto', 'on'];
        const flashIcons = ['⚡', '⚡A', '⚡'];
        
        // Find current index and move to next
        const currentIndex = flashModes.indexOf(flashMode);
        const nextIndex = (currentIndex + 1) % flashModes.length;
        
        flashMode = flashModes[nextIndex];
        flashToggleButton.textContent = flashIcons[nextIndex];
        
        if (flashMode === 'off') {
            flashToggleButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        } else if (flashMode === 'auto') {
            flashToggleButton.style.backgroundColor = 'rgba(255, 204, 0, 0.7)';
        } else {
            flashToggleButton.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        }
        
        // Apply torch if available and mode is 'on'
        applyTorchMode();
    }
    
    // Apply torch mode to camera if available
    function applyTorchMode() {
        if (!stream) return;
        
        const videoTrack = stream.getVideoTracks()[0];
        
        if (videoTrack && videoTrack.getCapabilities && videoTrack.getCapabilities().torch) {
            try {
                videoTrack.applyConstraints({
                    advanced: [{ torch: flashMode === 'on' }]
                });
            } catch (error) {
                console.error('Error setting torch mode:', error);
            }
        }
    }
    
    // Toggle HDR mode
    function toggleHDR() {
        isHDRActive = !isHDRActive;
        
        if (isHDRActive) {
            hdrToggleButton.style.backgroundColor = 'rgba(255, 204, 0, 0.7)';
            showNotification('HDR Mode activated', 'success');
            modeIndicator.textContent = 'HDR';
            modeIndicator.style.display = 'inline';
        } else {
            hdrToggleButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            modeIndicator.style.display = 'none';
        }
    }
    
    // Toggle timer
    function toggleTimer() {
        isTimerActive = !isTimerActive;
        
        if (isTimerActive) {
            timerToggleButton.style.backgroundColor = 'rgba(255, 204, 0, 0.7)';
            showNotification('3-second timer activated', 'info');
        } else {
            timerToggleButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        }
    }
    
    // Toggle grid
    function toggleGrid() {
        isGridVisible = !isGridVisible;
        
        if (isGridVisible) {
            gridToggleButton.style.backgroundColor = 'rgba(255, 204, 0, 0.7)';
            compositionGrid.classList.add('active');
        } else {
            gridToggleButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            compositionGrid.classList.remove('active');
        }
    }
    
    // Update mode indicators
    function updateModeIndicators() {
        switch (currentMode) {
            case 'photo':
                showNotification('Standard Photo Mode', 'info');
                break;
            case 'portrait':
                showNotification('Portrait Mode - Keep subject 2-8 feet away', 'info');
                break;
            case 'stack':
                showNotification(`Stack Mode - Capturing ${stackFrameCount} frames for enhanced quality`, 'info');
                break;
            case 'timelapse':
                showNotification('Time-lapse Mode - Hold still for best results', 'info');
                break;
            case 'slowmo':
                showNotification('Slow Motion Mode - Enhanced frame rate active', 'info');
                break;
        }
    }
    
    // Handle device orientation for level indicator
    function handleOrientation(event) {
        deviceOrientation.alpha = event.alpha || 0; // Z-axis rotation
        deviceOrientation.beta = event.beta || 0;   // X-axis rotation
        deviceOrientation.gamma = event.gamma || 0; // Y-axis rotation
        
        // Update level indicator if needed
        updateLevelIndicator();
    }
    
    // Update level indicator based on device orientation
    function updateLevelIndicator() {
        const gamma = deviceOrientation.gamma; // Left-right tilt
        
        // Only show when in photo mode and within reasonable range
        if (currentMode === 'photo' && Math.abs(gamma) < 20) {
            levelIndicator.classList.add('active');
            
            // Map gamma (-20 to 20) to position (0 to 100%)
            const position = ((gamma + 20) / 40) * 100;
            const bubble = levelIndicator.querySelector('.level-bubble');
            bubble.style.left = `${position}%`;
            
            // Change color when close to level
            if (Math.abs(gamma) < 2) {
                bubble.style.backgroundColor = '#4CD964'; // Green
            } else {
                bubble.style.backgroundColor = 'white';
            }
        } else {
            levelIndicator.classList.remove('active');
        }
    }
    
    // Take a photo
    function takePhoto() {
        if (isTakingPhoto) return;
        
        // If timer is active, start countdown
        if (isTimerActive) {
            startPhotoTimer();
            return;
        }
        
        // Based on current mode, take different types of photos
        switch (currentMode) {
            case 'stack':
                captureStackedPhoto();
                break;
            case 'portrait':
                capturePortraitPhoto();
                break;
            case 'timelapse':
                captureTimelapse();
                break;
            case 'slowmo':
                captureSlowMotion();
                break;
            default:
                captureStandardPhoto();
        }
    }
    
    // Start photo timer
    function startPhotoTimer() {
        isTakingPhoto = true;
        
        // Create timer overlay
        const timerOverlay = document.createElement('div');
        timerOverlay.className = 'timer-overlay';
        timerOverlay.innerHTML = '<div class="timer-count">3</div>';
        viewfinder.parentElement.appendChild(timerOverlay);
        
        let count = 3;
        const countElement = timerOverlay.querySelector('.timer-count');
        
        const timerInterval = setInterval(() => {
            count--;
            countElement.textContent = count;
            
            // Play countdown sound
            playSound('tick');
            
            if (count === 0) {
                clearInterval(timerInterval);
                
                // Flash screen white
                timerOverlay.style.backgroundColor = 'white';
                setTimeout(() => {
                    timerOverlay.remove();
                    isTakingPhoto = false;
                    
                    // Take the photo based on current mode
                    takePhoto();
                }, 200);
            }
        }, 1000);
    }
    
    // Capture a standard photo
    function captureStandardPhoto() {
        isTakingPhoto = true;
        
        // Flash animation
        flashScreen();
        
        // Play shutter sound
        playSound('shutter');
        
        // Capture the frame from video
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match video
        canvas.width = viewfinder.videoWidth;
        canvas.height = viewfinder.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(viewfinder, 0, 0, canvas.width, canvas.height);
        
        // Apply selected filter
        if (currentFilter !== 'normal' || isPawMode) {
            applyFilterToCanvas(context, canvas.width, canvas.height, isPawMode ? 'pawify' : currentFilter);
        }
        
        // Apply HDR effect if active
        if (isHDRActive) {
            applyHDREffect(context, canvas.width, canvas.height);
        }
        
        // Convert to data URL
        const photoData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Save to gallery
        savePhotoToGallery(photoData, 'photo');
        
        // Show preview briefly
        showPhotoPreview(photoData);
        
        // Release flag
        setTimeout(() => {
            isTakingPhoto = false;
        }, 500);
    }
    
    // Capture a stacked photo for improved quality
    function captureStackedPhoto() {
        if (!stream) return;
        
        isTakingPhoto = true;
        
        // Create stack progress indicator
        const stackProgress = document.createElement('div');
        stackProgress.className = 'stack-progress';
        stackProgress.innerHTML = `
            <div class="stack-indicator"></div>
            <div class="stack-status">Capturing stack</div>
            <div class="stack-counter">0/${stackFrameCount}</div>
        `;
        viewfinder.parentElement.appendChild(stackProgress);
        
        // Show stack progress
        setTimeout(() => {
            stackProgress.classList.add('active');
        }, 10);
        
        // Play start sound
        playSound('stackStart');
        
        // Prepare to capture multiple frames
        const frames = [];
        let capturedFrames = 0;
        const stackCounter = stackProgress.querySelector('.stack-counter');
        
        // Function to capture a single frame
        function captureFrame() {
            if (!stream || capturedFrames >= stackFrameCount) {
                processStackedFrames();
                return;
            }
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewfinder.videoWidth;
            canvas.height = viewfinder.videoHeight;
            context.drawImage(viewfinder, 0, 0, canvas.width, canvas.height);
            
            frames.push({
                data: context.getImageData(0, 0, canvas.width, canvas.height),
                width: canvas.width,
                height: canvas.height
            });
            
            capturedFrames++;
            stackCounter.textContent = `${capturedFrames}/${stackFrameCount}`;
            
            // Play tick sound every 3 frames
            if (capturedFrames % 3 === 0) {
                playSound('tick');
            }
            
            // Capture next frame after a short delay
            setTimeout(captureFrame, 100);
        }
        
        // Process all frames once captured
        function processStackedFrames() {
            stackProgress.querySelector('.stack-status').textContent = 'Processing HDR stack';
            
            // Short delay to allow UI to update
            setTimeout(() => {
                const finalCanvas = document.createElement('canvas');
                const finalContext = finalCanvas.getContext('2d');
                
                finalCanvas.width = frames[0].width;
                finalCanvas.height = frames[0].height;
                
                if (isSuperResEnabled) {
                    // Apply super-resolution algorithm
                    stackProgress.querySelector('.stack-status').textContent = 'Applying super-resolution';
                    const enhancedImage = applySuperResolution(frames);
                    finalContext.putImageData(enhancedImage, 0, 0);
                } else {
                    // Apply standard stacking algorithm (average frames for noise reduction)
                    const stackedImage = averageStackFrames(frames);
                    finalContext.putImageData(stackedImage, 0, 0);
                }
                
                // Apply selected filter
                if (currentFilter !== 'normal' || isPawMode) {
                    applyFilterToCanvas(finalContext, finalCanvas.width, finalCanvas.height, isPawMode ? 'pawify' : currentFilter);
                }
                
                // Convert to data URL
                const photoData = finalCanvas.toDataURL('image/jpeg', 0.95);
                
                // Save to gallery
                savePhotoToGallery(photoData, 'stack');
                
                // Play completion sound
                playSound('stackComplete');
                
                // Show preview
                showPhotoPreview(photoData);
                
                // Hide stack progress and release flag
                stackProgress.classList.remove('active');
                setTimeout(() => {
                    stackProgress.remove();
                    isTakingPhoto = false;
                }, 500);
            }, 500);
        }
        
        // Start capturing frames
        captureFrame();
    }
    
        // Average stack frames for noise reduction
        function averageStackFrames(frames) {
            const width = frames[0].width;
            const height = frames[0].height;
            
            // Create output buffer
            const result = new ImageData(width, height);
            const frameCount = frames.length;
            
            // For each pixel
            for (let i = 0; i < result.data.length; i += 4) {
                let r = 0, g = 0, b = 0, a = 0;
                
                // Sum values from all frames
                for (let f = 0; f < frameCount; f++) {
                    r += frames[f].data.data[i];
                    g += frames[f].data.data[i + 1];
                    b += frames[f].data.data[i + 2];
                    a += frames[f].data.data[i + 3];
                }
                
                // Average
                result.data[i] = r / frameCount;
                result.data[i + 1] = g / frameCount;
                result.data[i + 2] = b / frameCount;
                result.data[i + 3] = a / frameCount;
            }
            
            // Apply sharpening to compensate for any blur from averaging
            return applySharpening(result, width, height);
        }
        
        // Apply super-resolution algorithm to stacked frames
        function applySuperResolution(frames) {
            const width = frames[0].width;
            const height = frames[0].height;
            
            // Create high-resolution output buffer (2x scale)
            const upscaledWidth = width * 2;
            const upscaledHeight = height * 2;
            const result = new ImageData(upscaledWidth, upscaledHeight);
            
            // First, create an aligned and normalized stack
            const alignedStack = alignAndNormalizeFrames(frames);
            
            // Create a subpixel grid from aligned stack
            for (let y = 0; y < upscaledHeight; y++) {
                for (let x = 0; x < upscaledWidth; x++) {
                    // Map high-res coordinates to original image coordinates
                    const origX = Math.floor(x / 2);
                    const origY = Math.floor(y / 2);
                    
                    // Subpixel offset
                    const subpixelX = x % 2;
                    const subpixelY = y % 2;
                    
                    // Index in high-res output
                    const idx = (y * upscaledWidth + x) * 4;
                    
                    // Choose best frame for this subpixel position
                    let bestFrameIdx = 0;
                    if (subpixelX === 1 && subpixelY === 0) bestFrameIdx = 1;
                    if (subpixelX === 0 && subpixelY === 1) bestFrameIdx = 2;
                    if (subpixelX === 1 && subpixelY === 1) bestFrameIdx = 3;
                    
                    // If we don't have enough frames, fall back to 0
                    bestFrameIdx = Math.min(bestFrameIdx, alignedStack.length - 1);
                    
                    // Original pixel index
                    const origIdx = (origY * width + origX) * 4;
                    
                    // Fill in the high-res pixel
                    if (origX < width && origY < height) {
                        result.data[idx] = alignedStack[bestFrameIdx].data.data[origIdx];
                        result.data[idx + 1] = alignedStack[bestFrameIdx].data.data[origIdx + 1];
                        result.data[idx + 2] = alignedStack[bestFrameIdx].data.data[origIdx + 2];
                        result.data[idx + 3] = alignedStack[bestFrameIdx].data.data[origIdx + 3];
                    }
                }
            }
            
            // Apply advanced post-processing for enhanced details
            return enhanceDetails(result, upscaledWidth, upscaledHeight);
        }
        
        // Align and normalize frames for super-resolution
        function alignAndNormalizeFrames(frames) {
            // In a real implementation, this would use optical flow or phase correlation
            // for sub-pixel alignment. For this demo, we'll just use the original frames
            // but normalize their brightness.
            
            // Calculate average brightness of first frame as reference
            const referenceFrame = frames[0];
            let referenceBrightness = 0;
            
            for (let i = 0; i < referenceFrame.data.data.length; i += 4) {
                referenceBrightness += (
                    referenceFrame.data.data[i] + 
                    referenceFrame.data.data[i + 1] + 
                    referenceFrame.data.data[i + 2]
                ) / 3;
            }
            
            referenceBrightness /= (referenceFrame.data.data.length / 4);
            
            // Normalize each frame to match reference brightness
            const normalizedFrames = frames.map(frame => {
                const result = new ImageData(
                    new Uint8ClampedArray(frame.data.data), 
                    frame.width, 
                    frame.height
                );
                
                // Calculate this frame's brightness
                let brightness = 0;
                for (let i = 0; i < result.data.length; i += 4) {
                    brightness += (result.data[i] + result.data[i + 1] + result.data[i + 2]) / 3;
                }
                brightness /= (result.data.length / 4);
                
                // Apply brightness normalization
                const factor = referenceBrightness / brightness;
                for (let i = 0; i < result.data.length; i += 4) {
                    result.data[i] = Math.min(255, result.data[i] * factor);
                    result.data[i + 1] = Math.min(255, result.data[i + 1] * factor);
                    result.data[i + 2] = Math.min(255, result.data[i + 2] * factor);
                }
                
                return { data: result, width: frame.width, height: frame.height };
            });
            
            return normalizedFrames;
        }
        
        // Enhance details in the super-resolution output
        function enhanceDetails(imageData, width, height) {
            // Apply unsharp masking for detail enhancement
            const result = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
            
            // Create a blurred version for unsharp masking
            const blurred = applyGaussianBlur(result, width, height, 1.0);
            
            // Apply unsharp mask
            for (let i = 0; i < result.data.length; i += 4) {
                // Calculate difference for each channel
                const rDiff = result.data[i] - blurred.data[i];
                const gDiff = result.data[i + 1] - blurred.data[i + 1];
                const bDiff = result.data[i + 2] - blurred.data[i + 2];
                
                // Apply stronger sharpening for super-resolution
                const amount = 1.5;
                
                // Add scaled difference back to original
                result.data[i] = Math.max(0, Math.min(255, result.data[i] + rDiff * amount));
                result.data[i + 1] = Math.max(0, Math.min(255, result.data[i + 1] + gDiff * amount));
                result.data[i + 2] = Math.max(0, Math.min(255, result.data[i + 2] + bDiff * amount));
            }
            
            return result;
        }
        
        // Apply Gaussian blur for detail enhancement
        function applyGaussianBlur(imageData, width, height, sigma) {
            const result = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
            
            // Simple approximation of Gaussian blur using box blur passes
            const passes = 3;
            let current = result;
            
            for (let pass = 0; pass < passes; pass++) {
                current = applyBoxBlur(current, width, height, Math.ceil(sigma * 3 / passes));
            }
            
            return current;
        }
        
        // Apply box blur helper function
        function applyBoxBlur(imageData, width, height, radius) {
            const result = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
            const temp = new Uint8ClampedArray(imageData.data.length);
            
            // Horizontal pass
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let rSum = 0, gSum = 0, bSum = 0, count = 0;
                    
                    for (let i = Math.max(0, x - radius); i <= Math.min(width - 1, x + radius); i++) {
                        const idx = (y * width + i) * 4;
                        rSum += imageData.data[idx];
                        gSum += imageData.data[idx + 1];
                        bSum += imageData.data[idx + 2];
                        count++;
                    }
                    
                    const resultIdx = (y * width + x) * 4;
                    temp[resultIdx] = rSum / count;
                    temp[resultIdx + 1] = gSum / count;
                    temp[resultIdx + 2] = bSum / count;
                    temp[resultIdx + 3] = imageData.data[resultIdx + 3];
                }
            }
            
            // Vertical pass
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    let rSum = 0, gSum = 0, bSum = 0, count = 0;
                    
                    for (let j = Math.max(0, y - radius); j <= Math.min(height - 1, y + radius); j++) {
                        const idx = (j * width + x) * 4;
                        rSum += temp[idx];
                        gSum += temp[idx + 1];
                        bSum += temp[idx + 2];
                        count++;
                    }
                    
                    const resultIdx = (y * width + x) * 4;
                    result.data[resultIdx] = rSum / count;
                    result.data[resultIdx + 1] = gSum / count;
                    result.data[resultIdx + 2] = bSum / count;
                    result.data[resultIdx + 3] = imageData.data[resultIdx + 3];
                }
            }
            
            return result;
        }
        
        // Apply sharpening to an image
        function applySharpening(imageData, width, height) {
            const result = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
            const tempData = new Uint8ClampedArray(imageData.data);
            
            // For each pixel (except borders)
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // Apply simple Laplacian kernel for sharpening
                    for (let c = 0; c < 3; c++) {
                        const centerValue = tempData[idx + c];
                        const topValue = tempData[((y - 1) * width + x) * 4 + c];
                        const leftValue = tempData[(y * width + (x - 1)) * 4 + c];
                        const rightValue = tempData[(y * width + (x + 1)) * 4 + c];
                        const bottomValue = tempData[((y + 1) * width + x) * 4 + c];
                        
                        // Calculate Laplacian
                        const laplacian = centerValue * 5 - topValue - leftValue - rightValue - bottomValue;
                        
                        // Apply sharpening with strength factor
                        const strength = 0.5;
                        const sharpened = centerValue + laplacian * strength;
                        
                        // Clamp result
                        result.data[idx + c] = Math.max(0, Math.min(255, sharpened));
                    }
                }
            }
            
            return result;
        }
        
        // Capture a portrait photo with simulated depth effect
        function capturePortraitPhoto() {
            isTakingPhoto = true;
            
            // Flash animation
            flashScreen();
            
            // Play shutter sound
            playSound('shutter');
            
            // Capture the current frame
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewfinder.videoWidth;
            canvas.height = viewfinder.videoHeight;
            context.drawImage(viewfinder, 0, 0, canvas.width, canvas.height);
            
            // Apply portrait mode effect (simulation)
            applyPortraitEffect(context, canvas.width, canvas.height);
            
            // Apply filter if needed
            if (currentFilter !== 'normal' || isPawMode) {
                applyFilterToCanvas(context, canvas.width, canvas.height, isPawMode ? 'pawify' : currentFilter);
            }
            
            // Convert to data URL
            const photoData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Save to gallery
            savePhotoToGallery(photoData, 'portrait');
            
            // Show preview
            showPhotoPreview(photoData);
            
            // Release flag
            setTimeout(() => {
                isTakingPhoto = false;
            }, 500);
        }
        
        // Apply portrait mode effect with simulated depth
        function applyPortraitEffect(context, width, height) {
            // This is a simplified portrait mode that simulates depth blur
            // In a real implementation, this would use depth estimation from dual cameras
            
            // Simulate face detection in center area (30-70% of frame)
            const centerX = width * 0.5;
            const centerY = height * 0.5;
            const faceSize = Math.min(width, height) * 0.4;
            
            // Create a temporary canvas for the blur effect
            const tempCanvas = document.createElement('canvas');
            const tempContext = tempCanvas.getContext('2d');
            tempCanvas.width = width;
            tempCanvas.height = height;
            
            // Copy the original image
            tempContext.drawImage(context.canvas, 0, 0);
            
            // Apply a strong blur to the temp canvas
            applyCanvasBlur(tempContext, 15);
            
            // Create a gradient mask for the blur effect
            const gradient = context.createRadialGradient(
                centerX, centerY, faceSize * 0.5,  // Inner circle (in focus)
                centerX, centerY, faceSize * 1.2   // Outer circle (blurred)
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');      // In focus
            gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');  // Transition
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');      // Fully blurred
            
            // Apply the gradient mask
            context.save();
            context.globalCompositeOperation = 'destination-out';
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, height);
            context.restore();
            
            // Draw the blurred background where the mask was applied
            context.save();
            context.globalCompositeOperation = 'destination-over';
            context.drawImage(tempCanvas, 0, 0);
            context.restore();
            
            // Add a subtle warm tone to enhance portrait look
            applyColorTone(context, width, height, [255, 220, 200, 0.1]);
        }
        
        // Apply canvas blur for portrait mode
        function applyCanvasBlur(context, radius) {
            // Stack Blur algorithm implementation (simplified version)
            const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
            const pixels = imageData.data;
            
            let x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum, a_sum, 
                r_out_sum, g_out_sum, b_out_sum, a_out_sum,
                r_in_sum, g_in_sum, b_in_sum, a_in_sum,
                pr, pg, pb, pa, rbs;
            
            const width = context.canvas.width;
            const height = context.canvas.height;
            const div = radius + radius + 1;
            const widthMinus1 = width - 1;
            const heightMinus1 = height - 1;
            const radiusPlus1 = radius + 1;
            const sumFactor = radiusPlus1 * (radiusPlus1 + 1) / 2;
            
            const stackStart = new BlurStack();
            let stack = stackStart;
            let stackEnd;
            for (i = 1; i < div; i++) {
                stack = stack.next = new BlurStack();
                if (i === radiusPlus1) stackEnd = stack;
            }
            stack.next = stackStart;
            
            const mulSum = 1 / (div);
            
            // For each row
            for (y = 0; y < height; y++) {
                r_in_sum = g_in_sum = b_in_sum = a_in_sum = r_sum = g_sum = b_sum = a_sum = 0;
                
                yi = y * width * 4;
                
                // Prime the stack
                for (i = -radius; i <= radius; i++) {
                    p = yi + Math.min(widthMinus1, Math.max(0, i)) * 4;
                    stack = stackStart;
                    
                    stack.r = pixels[p];
                    stack.g = pixels[p + 1];
                    stack.b = pixels[p + 2];
                    stack.a = pixels[p + 3];
                    
                    rbs = radiusPlus1 - Math.abs(i);
                    r_sum += stack.r * rbs;
                    g_sum += stack.g * rbs;
                    b_sum += stack.b * rbs;
                    a_sum += stack.a * rbs;
                    
                    stack = stack.next;
                }
                
                // Process pixels
                for (x = 0; x < width; x++) {
                    r_out_sum = g_out_sum = b_out_sum = a_out_sum = 0;
                    
                    yi = (y * width + x) * 4;
                    
                    r_sum -= r_out_sum;
                    g_sum -= g_out_sum;
                    b_sum -= b_out_sum;
                    a_sum -= a_out_sum;
                    
                    // Process row
                    r_out_sum = g_out_sum = b_out_sum = a_out_sum = 0;
                    
                    if (x === 0) {
                        // Left edge case
                        r_in_sum = g_in_sum = b_in_sum = a_in_sum = 0;
                        for (i = -radius; i <= radius; i++) {
                            if (i >= 0) {
                                p = yi + i * 4;
                                r_in_sum += pixels[p];
                                g_in_sum += pixels[p + 1];
                                b_in_sum += pixels[p + 2];
                                a_in_sum += pixels[p + 3];
                            }
                        }
                    } else {
                        // For all other pixels, adjust sums
                        p = yi + (x + radius >= width ? width - 1 : x + radius) * 4;
                        r_in_sum += pixels[p];
                        g_in_sum += pixels[p + 1];
                        b_in_sum += pixels[p + 2];
                        a_in_sum += pixels[p + 3];
                        
                        p = yi + (x - radius - 1 >= 0 ? x - radius - 1 : 0) * 4;
                        r_in_sum -= pixels[p];
                        g_in_sum -= pixels[p + 1];
                        b_in_sum -= pixels[p + 2];
                        a_in_sum -= pixels[p + 3];
                    }
                    
                    pixels[yi] = (r_sum * mulSum) >>> 0;
                    pixels[yi + 1] = (g_sum * mulSum) >>> 0;
                    pixels[yi + 2] = (b_sum * mulSum) >>> 0;
                    pixels[yi + 3] = (a_sum * mulSum) >>> 0;
                }
            }
            
            context.putImageData(imageData, 0, 0);
        }
        
        // Helper class for the blur algorithm
        function BlurStack() {
            this.r = 0;
            this.g = 0;
            this.b = 0;
            this.a = 0;
            this.next = null;
        }
        
        // Apply color tone for portrait enhancement
        function applyColorTone(context, width, height, tone) {
            context.save();
            context.globalCompositeOperation = 'overlay';
            context.fillStyle = `rgba(${tone[0]}, ${tone[1]}, ${tone[2]}, ${tone[3]})`;
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        
        // Apply filter effect to canvas
        function applyFilterToCanvas(context, width, height, filter) {
            switch (filter) {
                case 'vintage':
                    applyVintageFilter(context, width, height);
                    break;
                case 'bw':
                    applyBlackAndWhiteFilter(context, width, height);
                    break;
                case 'sepia':
                    applySepiaFilter(context, width, height);
                    break;
                case 'vivid':
                    applyVividFilter(context, width, height);
                    break;
                case 'pawify':
                    applyPawifyFilter(context, width, height);
                    break;
                case 'dramatic':
                    applyDramaticFilter(context, width, height);
                    break;
                case 'noir':
                    applyNoirFilter(context, width, height);
                    break;
            }
        }
        
        // Apply vintage filter
        function applyVintageFilter(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Add sepia tone
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                data[i] = Math.min(255, r * 0.9 + g * 0.1 + b * 0.1);
                data[i + 1] = Math.min(255, r * 0.2 + g * 0.8 + b * 0.2);
                data[i + 2] = Math.min(255, r * 0.1 + g * 0.1 + b * 0.8);
                
                // Add color shift to reds and blues
                data[i] = Math.min(255, data[i] + 20);
                data[i + 2] = Math.max(0, data[i + 2] - 10);
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add vignette effect
            addVignette(context, width, height, 0.8);
            
            // Add slight grain
            addNoise(context, width, height, 10);
        }
        
        // Apply black and white filter
        function applyBlackAndWhiteFilter(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Use luminance formula for more natural BW conversion
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                
                // Increase contrast slightly
                const contrast = 1.2;
                const adjustedLuminance = 128 + contrast * (luminance - 128);
                
                data[i] = data[i + 1] = data[i + 2] = adjustedLuminance;
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add subtle vignette
            addVignette(context, width, height, 0.7);
        }
        
        // Apply sepia filter
        function applySepiaFilter(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
                data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
                data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add vignette
            addVignette(context, width, height, 0.7);
        }
        
        // Apply vivid filter
        function applyVividFilter(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Increase saturation and contrast
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Convert to HSL
                const [h, s, l] = rgbToHsl(r, g, b);
                
                // Increase saturation and adjust lightness
                const newS = Math.min(1, s * 1.5);
                const newL = l < 0.5 ? l * 0.9 : Math.min(1, l * 1.1);
                
                // Convert back to RGB
                const [newR, newG, newB] = hslToRgb(h, newS, newL);
                
                data[i] = newR;
                data[i + 1] = newG;
                data[i + 2] = newB;
            }
            
            context.putImageData(imageData, 0, 0);
        }
        
        // Apply pawify filter
        function applyPawifyFilter(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Add warm pink/purple tone to image
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Shift colors toward pink/purple
                data[i] = Math.min(255, r * 1.1);
                data[i + 1] = Math.min(255, g * 0.9);
                data[i + 2] = Math.min(255, b * 1.1);
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add vignette with pink/purple tint
            context.save();
            const gradient = context.createRadialGradient(
                width / 2, height / 2, height * 0.3,
                width / 2, height / 2, height * 0.7
            );
            gradient.addColorStop(0, 'rgba(255, 105, 180, 0)');
            gradient.addColorStop(1, 'rgba(255, 105, 180, 0.3)');
            
            context.globalCompositeOperation = 'overlay';
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, height);
            context.restore();
            
            // Add paw print overlay in corner
            const pawSize = Math.min(width, height) * 0.15;
            context.save();
            context.globalAlpha = 0.3;
            context.globalCompositeOperation = 'lighter';
            
            // Draw paw in bottom right corner
            context.translate(width - pawSize, height - pawSize);
            drawPawPrint(context, pawSize);
            context.restore();
        }
        
        // Draw a paw print for the pawify filter
        function drawPawPrint(context, size) {
            // Main pad
            context.beginPath();
            context.fillStyle = 'rgba(255, 105, 180, 0.6)';
            context.ellipse(size * 0.5, size * 0.7, size * 0.3, size * 0.4, 0, 0, Math.PI * 2);
            context.fill();
            
            // Toe pads
            const toePositions = [
                [0.3, 0.3], [0.7, 0.3],   // Top left, top right
                [0.2, 0.6], [0.8, 0.6]     // Bottom left, bottom right
            ];
            
            toePositions.forEach(pos => {
                context.beginPath();
                context.fillStyle = 'rgba(255, 105, 180, 0.6)';
                context.ellipse(size * pos[0], size * pos[1], size * 0.15, size * 0.2, 0, 0, Math.PI * 2);
                context.fill();
            });
        }
        
        // Apply dramatic filter
        function applyDramaticFilter(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Increase contrast dramatically
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // High contrast
                const contrast = 1.5;
                
                data[i] = Math.max(0, Math.min(255, 128 + contrast * (r - 128)));
                data[i + 1] = Math.max(0, Math.min(255, 128 + contrast * (g - 128)));
                data[i + 2] = Math.max(0, Math.min(255, 128 + contrast * (b - 128)));
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add strong vignette
            addVignette(context, width, height, 1.5);
            
            // Add slight color tint to highlights
            context.save();
            context.globalCompositeOperation = 'overlay';
            context.fillStyle = 'rgba(60, 60, 90, 0.3)';
            context.fillRect(0, 0, width, height);
            context.restore();
        }
        
        // Apply noir filter
        function applyNoirFilter(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // High contrast black and white with dark tones
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Weighted luminance with high contrast
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                const contrast = 1.8;
                let adjustedLuminance = 128 + contrast * (luminance - 128);
                
                // Darken overall image
                adjustedLuminance = adjustedLuminance * 0.85;
                
                data[i] = data[i + 1] = data[i + 2] = adjustedLuminance;
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add strong vignette
            addVignette(context, width, height, 1.8);
            
            // Add grain/noise
            addNoise(context, width, height, 15);
        }
        
        // Add vignette effect
        function addVignette(context, width, height, intensity) {
            context.save();
            
            // Create radial gradient
            const gradient = context.createRadialGradient(
                width / 2, height / 2, Math.min(width, height) * 0.3,
                width / 2, height / 2, Math.min(width, height) * 0.7
            );
            
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.8, intensity * 0.5)})`);
            
            context.globalCompositeOperation = 'multiply';
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, height);
            
            context.restore();
        }
        
        // Add noise/grain effect
        function addNoise(context, width, height, amount) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Add random noise to each channel
                const noise = Math.random() * 2 - 1; // -1 to 1
                const adjustment = noise * amount;
                
                data[i] = Math.max(0, Math.min(255, data[i] + adjustment));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment));
            }
            
            context.putImageData(imageData, 0, 0);
        }
        
        // Convert RGB to HSL
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
        
        // Convert HSL to RGB
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
            
            return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        }
        
        // Flash screen for camera effect
        function flashScreen() {
            const flashOverlay = document.createElement('div');
            flashOverlay.className = 'flash-overlay';
            viewfinder.parentElement.appendChild(flashOverlay);
            
            setTimeout(() => {
                flashOverlay.remove();
            }, 500);
        }
        
        // Apply HDR effect
        function applyHDREffect(context, width, height) {
            const imageData = context.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // Simulate HDR by expanding dynamic range and enhancing local contrast
            for (let i = 0; i < data.length; i += 4) {
                // Extract color channels
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Convert to HSL
                const [h, s, l] = rgbToHsl(r, g, b);
                
                // Expand shadows and highlights while preserving midtones
                let newL;
                if (l < 0.4) {
                    // Lift shadows
                    newL = l * 1.2;
                } else if (l > 0.6) {
                    // Recover highlights
                    newL = 0.6 + (l - 0.6) * 0.8;
                } else {
                    // Enhance midtones
                    newL = l;
                }
                
                // Enhance saturation in midtones, reduce in shadows and highlights
                let newS;
                if (l < 0.2 || l > 0.8) {
                    newS = s * 0.8;
                } else {
                    newS = Math.min(1, s * 1.2);
                }
                
                // Convert back to RGB
                const [newR, newG, newB] = hslToRgb(h, newS, newL);
                
                data[i] = newR;
                data[i + 1] = newG;
                data[i + 2] = newB;
            }
            
            context.putImageData(imageData, 0, 0);
            
            // Add subtle glow to highlights
            context.save();
            context.globalCompositeOperation = 'lighten';
            context.filter = 'blur(5px)';
            context.drawImage(context.canvas, 0, 0);
            context.filter = 'brightness(1.2) saturate(1.2)';
            context.globalAlpha = 0.3;
            context.drawImage(context.canvas, 0, 0);
            context.restore();
        }
        
        // Show photo preview after capture
        function showPhotoPreview(photoData) {
            const previewElement = document.createElement('div');
            previewElement.className = 'photo-preview';
            previewElement.innerHTML = `<img src="${photoData}" alt="Captured photo">`;
            
            document.body.appendChild(previewElement);
            
            // Animate in
            setTimeout(() => {
                previewElement.classList.add('active');
            }, 10);
            
            // Auto dismiss after 2 seconds
            setTimeout(() => {
                previewElement.classList.remove('active');
                setTimeout(() => {
                    previewElement.remove();
                }, 300);
            }, 2000);
        }
        
        // Save photo to gallery
        function savePhotoToGallery(photoData, mode) {
            const timestamp = new Date().toISOString();
            const photo = {
                id: generateUUID(),
                data: photoData,
                timestamp: timestamp,
                mode: mode,
                filter: currentFilter,
                isFavorite: false,
                location: getCurrentLocation()
            };
            
            // Add to saved photos array
            savedPhotos.push(photo);
            
            // Save to localStorage
            localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            
            // Show notification
            showNotification('Photo saved to gallery', 'success');
            
            // Update gallery count
            updateGalleryCount();
        }
        
        // Get current location (simplified)
        function getCurrentLocation() {
            return null; // In a real app, this would use the Geolocation API
        }
        
        // Generate a UUID for photo IDs
        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        
        // Update gallery count indicator
        function updateGalleryCount() {
            const galleryCount = document.querySelector('.gallery-count');
            if (galleryCount) {
                galleryCount.textContent = savedPhotos.length;
                
                if (savedPhotos.length > 0) {
                    galleryCount.classList.add('active');
                } else {
                    galleryCount.classList.remove('active');
                }
            }
        }
        
        // Render gallery
        function renderGallery() {
            const galleryGrid = document.querySelector('.gallery-grid');
            galleryGrid.innerHTML = '';
            
            // Sort photos by timestamp (newest first)
            const sortedPhotos = [...savedPhotos].sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            
            if (sortedPhotos.length === 0) {
                galleryGrid.innerHTML = '<div class="empty-gallery">No photos yet. Start capturing!</div>';
                return;
            }
            
            sortedPhotos.forEach(photo => {
                const photoElement = document.createElement('div');
                photoElement.className = 'gallery-item';
                photoElement.dataset.id = photo.id;
                photoElement.dataset.mode = photo.mode;
                
                if (photo.isFavorite) {
                    photoElement.classList.add('favorite');
                }
                
                // Create date formatter
                const date = new Date(photo.timestamp);
                const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                
                photoElement.innerHTML = `
                    <img src="${photo.data}" alt="Photo">
                    <div class="photo-info">
                        <div class="photo-date">${formattedDate}</div>
                        <div class="photo-mode">${photo.mode.toUpperCase()}</div>
                    </div>
                    <div class="photo-actions">
                        <button class="favorite-button">${photo.isFavorite ? '★' : '☆'}</button>
                        <button class="edit-button">Edit</button>
                        <button class="share-button">Share</button>
                        <button class="delete-button">Delete</button>
                    </div>
                `;
                
                // Add to gallery
                galleryGrid.appendChild(photoElement);
                
                // Add event listeners
                photoElement.querySelector('.favorite-button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(photo.id);
                });
                
                photoElement.querySelector('.edit-button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openPhotoEditor(photo.id);
                });
                
                photoElement.querySelector('.share-button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    sharePhoto(photo.data);
                });
                
                photoElement.querySelector('.delete-button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    deletePhoto(photo.id);
                });
                
                // Open full screen view when clicking on photo
                photoElement.addEventListener('click', () => {
                    openPhotoFullscreen(photo.id);
                });
            });
        }
        
        // Toggle favorite status
        function toggleFavorite(photoId) {
            const photoIndex = savedPhotos.findIndex(p => p.id === photoId);
            if (photoIndex >= 0) {
                savedPhotos[photoIndex].isFavorite = !savedPhotos[photoIndex].isFavorite;
                
                // Update UI
                const photoElement = document.querySelector(`.gallery-item[data-id="${photoId}"]`);
                if (photoElement) {
                    const favoriteButton = photoElement.querySelector('.favorite-button');
                    
                    if (savedPhotos[photoIndex].isFavorite) {
                        photoElement.classList.add('favorite');
                        favoriteButton.textContent = '★';
                        showNotification('Added to favorites', 'success');
                    } else {
                        photoElement.classList.remove('favorite');
                        favoriteButton.textContent = '☆';
                        showNotification('Removed from favorites', 'info');
                    }
                }
                
                // Save to localStorage
                localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            }
        }
        
        // Open photo editor
        function openPhotoEditor(photoId) {
            const photo = savedPhotos.find(p => p.id === photoId);
            if (!photo) return;
            
            // Create editor overlay
            const editorOverlay = document.createElement('div');
            editorOverlay.className = 'editor-overlay';
            
            // Create editor content
            editorOverlay.innerHTML = `
                <div class="editor-container">
                    <div class="editor-header">
                        <h2>Edit Photo</h2>
                        <button class="close-editor">×</button>
                    </div>
                    <div class="editor-preview">
                        <img src="${photo.data}" alt="Editing photo">
                    </div>
                    <div class="editor-controls">
                        <div class="filter-section">
                            <h3>Filters</h3>
                            <div class="filter-options">
                                <button class="filter-option" data-filter="normal">Normal</button>
                                <button class="filter-option" data-filter="bw">B&W</button>
                                <button class="filter-option" data-filter="sepia">Sepia</button>
                                <button class="filter-option" data-filter="vivid">Vivid</button>
                                <button class="filter-option" data-filter="vintage">Vintage</button>
                                <button class="filter-option" data-filter="dramatic">Dramatic</button>
                                <button class="filter-option" data-filter="noir">Noir</button>
                                <button class="filter-option" data-filter="pawify">Pawify</button>
                            </div>
                        </div>
                        <div class="adjustment-section">
                            <h3>Adjustments</h3>
                            <div class="adjustment-controls">
                                <div class="adjustment-control">
                                    <label>Brightness</label>
                                    <input type="range" min="-50" max="50" value="0" class="brightness-slider">
                                </div>
                                <div class="adjustment-control">
                                    <label>Contrast</label>
                                    <input type="range" min="-50" max="50" value="0" class="contrast-slider">
                                </div>
                                <div class="adjustment-control">
                                    <label>Saturation</label>
                                    <input type="range" min="-50" max="50" value="0" class="saturation-slider">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="editor-actions">
                        <button class="reset-button">Reset</button>
                        <button class="save-button">Save</button>
                    </div>
                </div>
            `;
            
            // Add to DOM
            document.body.appendChild(editorOverlay);
            
            // Show with animation
            setTimeout(() => {
                editorOverlay.classList.add('active');
            }, 10);
            
            // Get references to editor elements
            const closeButton = editorOverlay.querySelector('.close-editor');
            const filterButtons = editorOverlay.querySelectorAll('.filter-option');
            const brightnessSlider = editorOverlay.querySelector('.brightness-slider');
            const contrastSlider = editorOverlay.querySelector('.contrast-slider');
            const saturationSlider = editorOverlay.querySelector('.saturation-slider');
            const resetButton = editorOverlay.querySelector('.reset-button');
            const saveButton = editorOverlay.querySelector('.save-button');
            const previewImg = editorOverlay.querySelector('.editor-preview img');
            
            // Track editing state
            const editState = {
                filter: photo.filter || 'normal',
                brightness: 0,
                contrast: 0,
                saturation: 0
            };
            
            // Highlight current filter
            filterButtons.forEach(btn => {
                if (btn.dataset.filter === editState.filter) {
                    btn.classList.add('active');
                }
                
                btn.addEventListener('click', () => {
                    // Update filter buttons
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Update edit state
                    editState.filter = btn.dataset.filter;
                    
                    // Update preview
                    updatePreview();
                });
            });
            
            // Setup slider events
            brightnessSlider.addEventListener('input', () => {
                editState.brightness = parseInt(brightnessSlider.value);
                updatePreview();
            });
            
            contrastSlider.addEventListener('input', () => {
                editState.contrast = parseInt(contrastSlider.value);
                updatePreview();
            });
            
            saturationSlider.addEventListener('input', () => {
                editState.saturation = parseInt(saturationSlider.value);
                updatePreview();
            });
            
            // Reset button
            resetButton.addEventListener('click', () => {
                editState.filter = photo.filter || 'normal';
                editState.brightness = 0;
                editState.contrast = 0;
                editState.saturation = 0;
                
                // Reset UI
                filterButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.filter === editState.filter);
                });
                
                brightnessSlider.value = 0;
                contrastSlider.value = 0;
                saturationSlider.value = 0;
                
                updatePreview();
                showNotification('Edit reset', 'info');
            });
            
            // Close button
            closeButton.addEventListener('click', () => {
                editorOverlay.classList.remove('active');
                setTimeout(() => {
                    editorOverlay.remove();
                }, 300);
            });
            
            // Save button
            saveButton.addEventListener('click', () => {
                // Apply final edits and save
                const editedPhoto = applyFinalEdits();
                
                // Update photo in saved photos
                const photoIndex = savedPhotos.findIndex(p => p.id === photoId);
                if (photoIndex >= 0) {
                    savedPhotos[photoIndex].data = editedPhoto;
                    savedPhotos[photoIndex].filter = editState.filter;
                    savedPhotos[photoIndex].editedAt = new Date().toISOString();
                    
                    // Save to localStorage
                    localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
                    
                    // Update gallery
                    renderGallery();
                    
                    // Close editor
                    editorOverlay.classList.remove('active');
                    setTimeout(() => {
                        editorOverlay.remove();
                    }, 300);
                    
                    showNotification('Photo updated', 'success');
                }
            });
            
            // Update preview with current edits
            function updatePreview() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Draw original image
                    ctx.drawImage(img, 0, 0);
                    
                    // Apply filter
                    if (editState.filter !== 'normal') {
                        applyFilterToCanvas(ctx, canvas.width, canvas.height, editState.filter);
                    }
                    
                    // Apply adjustments
                    applyAdjustments(ctx, canvas.width, canvas.height, editState);
                    
                    // Update preview
                    previewImg.src = canvas.toDataURL('image/jpeg', 0.95);
                };
                
                img.src = photo.data;
            }
            
            // Apply adjustments to canvas
            function applyAdjustments(ctx, width, height, state) {
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    // Get RGB values
                    let r = data[i];
                    let g = data[i + 1];
                    let b = data[i + 2];
                    
                    // Convert to HSL for easier adjustments
                    const [h, s, l] = rgbToHsl(r, g, b);
                    
                    // Apply brightness (affects lightness)
                    const brightnessFactor = 1 + (state.brightness / 100);
                    let newL = l * brightnessFactor;
                    
                    // Apply contrast (affects distance from mid-gray)
                    const contrastFactor = 1 + (state.contrast / 100);
                    newL = 0.5 + (newL - 0.5) * contrastFactor;
                    
                    // Apply saturation
                    const saturationFactor = 1 + (state.saturation / 100);
                    let newS = s * saturationFactor;
                    
                    // Clamp values
                    newL = Math.max(0, Math.min(1, newL));
                    newS = Math.max(0, Math.min(1, newS));
                    
                    // Convert back to RGB
                    const [newR, newG, newB] = hslToRgb(h, newS, newL);
                    
                    data[i] = newR;
                    data[i + 1] = newG;
                    data[i + 2] = newB;
                }
                
                ctx.putImageData(imageData, 0, 0);
            }
            
            // Apply final edits and return data URL
            function applyFinalEdits() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                return new Promise(resolve => {
                    img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        
                        // Draw original image
                        ctx.drawImage(img, 0, 0);
                        
                        // Apply filter
                        if (editState.filter !== 'normal') {
                            applyFilterToCanvas(ctx, canvas.width, canvas.height, editState.filter);
                        }
                        
                        // Apply adjustments
                        applyAdjustments(ctx, canvas.width, canvas.height, editState);
                        
                        // Return final image data
                        resolve(canvas.toDataURL('image/jpeg', 0.95));
                    };
                    
                    img.src = photo.data;
                });
            }
            
            // Initial preview update
            updatePreview();
        }
        
        // Open photo in fullscreen view
        function openPhotoFullscreen(photoId) {
            const photo = savedPhotos.find(p => p.id === photoId);
            if (!photo) return;
            
            const fullscreenView = document.createElement('div');
            fullscreenView.className = 'fullscreen-view';
            
            const date = new Date(photo.timestamp);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            fullscreenView.innerHTML = `
                <div class="fullscreen-header">
                    <button class="close-fullscreen">×</button>
                    <div class="photo-info">
                        <div class="photo-date">${formattedDate}</div>
                        <div class="photo-mode">${photo.mode.toUpperCase()}</div>
                    </div>
                    <div class="fullscreen-actions">
                        <button class="favorite-button">${photo.isFavorite ? '★' : '☆'}</button>
                        <button class="edit-button">Edit</button>
                        <button class="share-button">Share</button>
                        <button class="delete-button">Delete</button>
                    </div>
                </div>
                <div class="fullscreen-image">
                    <img src="${photo.data}" alt="Photo">
                </div>
            `;
            
            document.body.appendChild(fullscreenView);
            
            // Show with animation
            setTimeout(() => {
                fullscreenView.classList.add('active');
            }, 10);
            
            // Set up event listeners
            fullscreenView.querySelector('.close-fullscreen').addEventListener('click', () => {
                fullscreenView.classList.remove('active');
                setTimeout(() => {
                    fullscreenView.remove();
                }, 300);
            });
            
            fullscreenView.querySelector('.favorite-button').addEventListener('click', () => {
                toggleFavorite(photoId);
                
                // Update button in fullscreen view
                const favoriteButton = fullscreenView.querySelector('.favorite-button');
                const updatedPhoto = savedPhotos.find(p => p.id === photoId);
                
                if (updatedPhoto) {
                    favoriteButton.textContent = updatedPhoto.isFavorite ? '★' : '☆';
                }
            });
            
            fullscreenView.querySelector('.edit-button').addEventListener('click', () => {
                fullscreenView.classList.remove('active');
                setTimeout(() => {
                    fullscreenView.remove();
                    openPhotoEditor(photoId);
                }, 300);
            });
            
            fullscreenView.querySelector('.share-button').addEventListener('click', () => {
                sharePhoto(photo.data);
            });
            
            fullscreenView.querySelector('.delete-button').addEventListener('click', () => {
                fullscreenView.classList.remove('active');
                setTimeout(() => {
                    fullscreenView.remove();
                    deletePhoto(photoId);
                }, 300);
            });
        }
        
        // Share photo
        function sharePhoto(photoData) {
            // Web Share API if available
            if (navigator.share) {
                fetch(photoData)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], "pawshot.jpg", { type: "image/jpeg" });
                        navigator.share({
                            title: "PawShot Photo",
                            text: "Check out this photo I took with PawShot!",
                            files: [file]
                        })
                        .then(() => showNotification('Shared successfully', 'success'))
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
                // Find index
                const photoIndex = savedPhotos.findIndex(p => p.id === photoId);
                
                if (photoIndex >= 0) {
                    // Remove from array
                    savedPhotos.splice(photoIndex, 1);
                    
                    // Save to localStorage
                    localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
                    
                    // Update gallery
                    renderGallery();
                    
                    // Update gallery count
                    updateGalleryCount();
                    
                    showNotification('Photo deleted', 'info');
                }
            }
        }
        
        // Show notification
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = message;
            
            document.body.appendChild(notification);
            
            // Animate in
            setTimeout(() => {
                notification.classList.add('active');
            }, 10);
            
            // Auto dismiss
            setTimeout(() => {
                notification.classList.remove('active');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, 3000);
        }
        
        // Play sound effect
        function playSound(soundName) {
            if (!appSettings.soundEnabled) return;
            
            const soundEffects = {
                shutter: 'sounds/shutter.mp3',
                focus: 'sounds/focus.mp3',
                success: 'sounds/success.mp3',
                error: 'sounds/error.mp3'
            };
            
            if (soundEffects[soundName]) {
                const sound = new Audio(soundEffects[soundName]);
                sound.volume = 0.5;
                sound.play().catch(e => console.log('Sound play error:', e));
            }
        }
        
        // Open settings panel
        function openSettings() {
            const settingsOverlay = document.createElement('div');
            settingsOverlay.className = 'settings-overlay';
            
            settingsOverlay.innerHTML = `
                <div class="settings-container">
                    <div class="settings-header">
                        <h2>Settings</h2>
                        <button class="close-settings">×</button>
                    </div>
                    <div class="settings-content">
                        <div class="settings-group">
                            <h3>General</h3>
                            <div class="setting-item">
                                <label for="sound-toggle">Sound Effects</label>
                                <label class="switch">
                                    <input type="checkbox" id="sound-toggle" ${appSettings.soundEnabled ? 'checked' : ''}>
                                    <span class="slider round"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label for="save-original">Save Original Photos</label>
                                <label class="switch">
                                    <input type="checkbox" id="save-original" ${appSettings.saveOriginal ? 'checked' : ''}>
                                    <span class="slider round"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label for="high-quality">High Quality Capture</label>
                                <label class="switch">
                                    <input type="checkbox" id="high-quality" ${appSettings.highQuality ? 'checked' : ''}>
                                    <span class="slider round"></span>
                                </label>
                            </div>
                        </div>
                        <div class="settings-group">
                            <h3>Camera</h3>
                            <div class="setting-item">
                                <label for="grid-toggle">Grid Lines</label>
                                <label class="switch">
                                    <input type="checkbox" id="grid-toggle" ${appSettings.gridEnabled ? 'checked' : ''}>
                                    <span class="slider round"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label for="timer-duration">Timer Duration</label>
                                <select id="timer-duration">
                                    <option value="0" ${appSettings.timerDuration === 0 ? 'selected' : ''}>Off</option>
                                    <option value="3" ${appSettings.timerDuration === 3 ? 'selected' : ''}>3 seconds</option>
                                    <option value="5" ${appSettings.timerDuration === 5 ? 'selected' : ''}>5 seconds</option>
                                    <option value="10" ${appSettings.timerDuration === 10 ? 'selected' : ''}>10 seconds</option>
                                </select>
                            </div>
                            <div class="setting-item">
                                <label for="default-filter">Default Filter</label>
                                <select id="default-filter">
                                    <option value="normal" ${appSettings.defaultFilter === 'normal' ? 'selected' : ''}>Normal</option>
                                    <option value="vivid" ${appSettings.defaultFilter === 'vivid' ? 'selected' : ''}>Vivid</option>
                                    <option value="bw" ${appSettings.defaultFilter === 'bw' ? 'selected' : ''}>Black & White</option>
                                    <option value="sepia" ${appSettings.defaultFilter === 'sepia' ? 'selected' : ''}>Sepia</option>
                                    <option value="vintage" ${appSettings.defaultFilter === 'vintage' ? 'selected' : ''}>Vintage</option>
                                    <option value="dramatic" ${appSettings.defaultFilter === 'dramatic' ? 'selected' : ''}>Dramatic</option>
                                    <option value="noir" ${appSettings.defaultFilter === 'noir' ? 'selected' : ''}>Noir</option>
                                    <option value="pawify" ${appSettings.defaultFilter === 'pawify' ? 'selected' : ''}>Pawify</option>
                                </select>
                            </div>
                        </div>
                        <div class="settings-group">
                            <h3>Advanced</h3>
                            <div class="setting-item">
                                <label>Cache Size</label>
                                <div class="cache-info">${calculateCacheSize()} MB used</div>
                                <button id="clear-cache" class="secondary-button">Clear Cache</button>
                            </div>
                            <div class="setting-item">
                                <label>App Version</label>
                                <div>PawShot 1.0.0</div>
                            </div>
                        </div>
                    </div>
                    <div class="settings-actions">
                        <button id="reset-settings" class="secondary-button">Reset to Default</button>
                        <button id="save-settings" class="primary-button">Save Settings</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(settingsOverlay);
            
            // Show with animation
            setTimeout(() => {
                settingsOverlay.classList.add('active');
            }, 10);
            
            // Set up event listeners
            const closeButton = settingsOverlay.querySelector('.close-settings');
            const saveButton = settingsOverlay.querySelector('#save-settings');
            const resetButton = settingsOverlay.querySelector('#reset-settings');
            const clearCacheButton = settingsOverlay.querySelector('#clear-cache');
            
            closeButton.addEventListener('click', () => {
                settingsOverlay.classList.remove('active');
                setTimeout(() => {
                    settingsOverlay.remove();
                }, 300);
            });
            
            saveButton.addEventListener('click', () => {
                // Get updated settings
                appSettings.soundEnabled = settingsOverlay.querySelector('#sound-toggle').checked;
                appSettings.saveOriginal = settingsOverlay.querySelector('#save-original').checked;
                appSettings.highQuality = settingsOverlay.querySelector('#high-quality').checked;
                appSettings.gridEnabled = settingsOverlay.querySelector('#grid-toggle').checked;
                appSettings.timerDuration = parseInt(settingsOverlay.querySelector('#timer-duration').value);
                appSettings.defaultFilter = settingsOverlay.querySelector('#default-filter').value;
                
                // Save to localStorage
                localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
                
                // Apply settings
                applySettings();
                
                // Close settings
                settingsOverlay.classList.remove('active');
                setTimeout(() => {
                    settingsOverlay.remove();
                }, 300);
                
                showNotification('Settings saved', 'success');
            });
            
            resetButton.addEventListener('click', () => {
                if (confirm('Reset all settings to default?')) {
                    // Reset to defaults
                    appSettings = {
                        soundEnabled: true,
                        saveOriginal: true,
                        highQuality: true,
                        gridEnabled: false,
                        timerDuration: 0,
                        defaultFilter: 'normal'
                    };
                    
                    // Save to localStorage
                    localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
                    
                    // Close and reopen settings
                    settingsOverlay.classList.remove('active');
                    setTimeout(() => {
                        settingsOverlay.remove();
                        openSettings();
                    }, 300);
                    
                    showNotification('Settings reset to default', 'info');
                }
            });
            
            clearCacheButton.addEventListener('click', () => {
                if (confirm('Clear all cached photos? This cannot be undone.')) {
                    // Clear saved photos
                    savedPhotos = [];
                    localStorage.removeItem('pawShotPhotos');
                    
                    // Update gallery count
                    updateGalleryCount();
                    
                    // Update cache size display
                    settingsOverlay.querySelector('.cache-info').textContent = '0 MB used';
                    
                    showNotification('Cache cleared', 'info');
                }
            });
        }
        
        // Calculate cache size in MB
        function calculateCacheSize() {
            let totalSize = 0;
            
            // Estimate size based on base64 data URIs
            savedPhotos.forEach(photo => {
                // Rough estimate: base64 length * 0.75 (base64 overhead) / 1024 / 1024 (to MB)
                totalSize += (photo.data.length * 0.75) / (1024 * 1024);
            });
            
            return totalSize.toFixed(2);
        }
        
        // Apply current settings
        function applySettings() {
            // Apply grid
            const gridOverlay = document.querySelector('.grid-overlay');
            if (gridOverlay) {
                gridOverlay.style.display = appSettings.gridEnabled ? 'block' : 'none';
            }
            
            // Apply default filter
            currentFilter = appSettings.defaultFilter;
            
            // Update filter buttons
            const filterButtons = document.querySelectorAll('.filter-option');
            filterButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === currentFilter);
            });
        }
        
        // Initialize settings
        function initSettings() {
            // Load settings from localStorage or use defaults
            const savedSettings = localStorage.getItem('pawShotSettings');
            
            if (savedSettings) {
                appSettings = JSON.parse(savedSettings);
            } else {
                appSettings = {
                    soundEnabled: true,
                    saveOriginal: true,
                    highQuality: true,
                    gridEnabled: false,
                    timerDuration: 0,
                    defaultFilter: 'normal'
                };
                
                // Save default settings
                localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
            }
            
            // Apply settings
            applySettings();
        }
        
        // Initialize app
        function initApp() {
            // Set up camera access
            initCamera();
            
            // Load saved photos
            const savedPhotoData = localStorage.getItem('pawShotPhotos');
            if (savedPhotoData) {
                try {
                    savedPhotos = JSON.parse(savedPhotoData);
                    updateGalleryCount();
                } catch (e) {
                    console.error('Error loading saved photos:', e);
                    savedPhotos = [];
                }
            }
            
            // Load settings
            initSettings();
            
            // Set up event listeners
            setupEventListeners();
            
            // Show welcome message on first run
            const isFirstRun = !localStorage.getItem('pawShotFirstRun');
            if (isFirstRun) {
                showWelcomeMessage();
                localStorage.setItem('pawShotFirstRun', 'false');
            }
        }
        
        // Show welcome message for first-time users
        function showWelcomeMessage() {
            const welcomeOverlay = document.createElement('div');
            welcomeOverlay.className = 'welcome-overlay';
            
            welcomeOverlay.innerHTML = `
                <div class="welcome-container">
                    <h1>Welcome to PawShot!</h1>
                    <p>Your advanced pet photography app with pro features:</p>
                    <ul>
                        <li>🐾 Portrait Mode with depth effect</li>
                        <li>🐾 Professional filters and editing</li>
                        <li>🐾 Night Mode for low-light shots</li>
                        <li>🐾 Burst Mode for action shots</li>
                        <li>🐾 Paw Mode for cute pet overlays</li>
                    </ul>
                    <button id="start-app" class="primary-button">Start Taking Photos</button>
                </div>
            `;
            
            document.body.appendChild(welcomeOverlay);
            
            // Show with animation
            setTimeout(() => {
                welcomeOverlay.classList.add('active');
            }, 10);
            
            // Start button
            welcomeOverlay.querySelector('#start-app').addEventListener('click', () => {
                welcomeOverlay.classList.remove('active');
                setTimeout(() => {
                    welcomeOverlay.remove();
                }, 300);
            });
        }
        
        // Setup all event listeners
        function setupEventListeners() {
            // Capture button
            document.querySelector('.capture-button').addEventListener('click', capturePhoto);
            
            // Mode switcher
            const modeSwitchButtons = document.querySelectorAll('.mode-switch-item');
            modeSwitchButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Update mode UI
                    modeSwitchButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    // Update current mode
                    currentMode = button.dataset.mode;
                    
                    // Apply mode-specific settings
                    applyModeSettings(currentMode);
                });
            });
            
            // Filter selector
            const filterButtons = document.querySelectorAll('.filter-option');
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Update filter UI
                    filterButtons.forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    
                    // Update current filter
                    currentFilter = button.dataset.filter;
                });
            });
            
            // Gallery button
            document.querySelector('.gallery-button').addEventListener('click', () => {
                document.querySelector('.camera-view').classList.add('hidden');
                document.querySelector('.gallery-view').classList.remove('hidden');
                
                // Render gallery
                renderGallery();
            });
            
            // Back to camera button
            document.querySelector('.back-to-camera').addEventListener('click', () => {
                document.querySelector('.gallery-view').classList.add('hidden');
                document.querySelector('.camera-view').classList.remove('hidden');
            });
            
            // Settings button
            document.querySelector('.settings-button').addEventListener('click', openSettings);
            
            // Flash toggle
            document.querySelector('.flash-toggle').addEventListener('click', function() {
                flashMode = (flashMode === 'off') ? 'on' : 'off';
                this.querySelector('i').textContent = (flashMode === 'on') ? 'flash_on' : 'flash_off';
                
                // Apply flash setting to track
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
            
            // Timer toggle
            document.querySelector('.timer-toggle').addEventListener('click', function() {
                const timerOptions = [0, 3, 5, 10];
                let currentIndex = timerOptions.indexOf(appSettings.timerDuration);
                currentIndex = (currentIndex + 1) % timerOptions.length;
                appSettings.timerDuration = timerOptions[currentIndex];
                
                // Update UI
                this.querySelector('span').textContent = appSettings.timerDuration === 0 ? 'Off' : `${appSettings.timerDuration}s`;
                
                // Save setting
                localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
            });
            
            // Grid toggle
            document.querySelector('.grid-toggle').addEventListener('click', function() {
                appSettings.gridEnabled = !appSettings.gridEnabled;
                
                // Update grid visibility
                const gridOverlay = document.querySelector('.grid-overlay');
                gridOverlay.style.display = appSettings.gridEnabled ? 'block' : 'none';
                
                // Update UI
                this.classList.toggle('active', appSettings.gridEnabled);
                
                // Save setting
                localStorage.setItem('pawShotSettings', JSON.stringify(appSettings));
            });
            
            // Camera toggle (front/back)
            document.querySelector('.camera-toggle').addEventListener('click', () => {
                // Toggle camera
                facingMode = facingMode === 'environment' ? 'user' : 'environment';
                
                // Restart camera with new facing mode
                stopCamera().then(() => {
                    initCamera();
                    
                    // Update icon
                    const icon = document.querySelector('.camera-toggle i');
                    icon.textContent = facingMode === 'environment' ? 'camera_rear' : 'camera_front';
                });
            });
            
            // Handle orientation change
            window.addEventListener('orientationchange', () => {
                // Adjust canvas size after orientation change
                setTimeout(() => {
                    resizeCanvas();
                    
                    // Restart camera with new orientation
                    if (videoTrack) {
                        stopCamera().then(() => {
                            initCamera();
                        });
                    }
                }, 300);
            });
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case ' ':  // Space bar
                        capturePhoto();
                        break;
                    case 'g':  // Gallery
                        document.querySelector('.gallery-button').click();
                        break;
                    case 'f':  // Flash
                        document.querySelector('.flash-toggle').click();
                        break;
                    case 't':  // Timer
                        document.querySelector('.timer-toggle').click();
                        break;
                    case 'c':  // Camera toggle
                        document.querySelector('.camera-toggle').click();
                        break;
                    case 'Escape':  // Back button
                        if (!document.querySelector('.gallery-view').classList.contains('hidden')) {
                            document.querySelector('.back-to-camera').click();
                        }
                        break;
                }
            });
            
            // Tap to focus
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
                        // Clamp to min/max zoom
                        newZoom = Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, newZoom));
                        
                        // Apply zoom
                        videoTrack.applyConstraints({
                            advanced: [{ zoom: newZoom }]
                        });
                        
                        // Update current zoom for next pinch
                        currentZoom = newZoom;
                        initialPinchDistance = currentDistance;
                    }
                    
                    e.preventDefault();
                }
            });
        }
        
        // Get distance between two touch points
        function getPinchDistance(touches) {
            return Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
        }
        
        // Show focus indicator
        function showFocusIndicator(x, y) {
            const indicator = document.createElement('div');
            indicator.className = 'focus-indicator';
            indicator.style.left = `${x}px`;
            indicator.style.top = `${y}px`;
            
            document.body.appendChild(indicator);
            
            // Play focus sound
            playSound('focus');
            
            // Animate
            setTimeout(() => {
                indicator.classList.add('focusing');
                
                setTimeout(() => {
                    indicator.classList.add('focused');
                    
                    setTimeout(() => {
                        indicator.remove();
                    }, 500);
                }, 500);
            }, 10);
        }
        
        // Focus camera at point
        function focusCamera(x, y) {
            if (!videoTrack) return;
            
            try {
                const capabilities = videoTrack.getCapabilities();
                
                // Check if camera supports focus point
                if (capabilities.focusMode && capabilities.focusMode.includes('manual')) {
                    videoTrack.applyConstraints({
                        advanced: [
                            {
                                focusMode: 'manual',
                                focusDistance: 0, // Auto distance
                                pointsOfInterest: [{ x, y }]
                            }
                        ]
                    });
                }
            } catch (e) {
                console.log('Focus not supported:', e);
            }
        }
        
        // Apply settings specific to current mode
        function applyModeSettings(mode) {
            // Update mode indicator
            document.querySelector('.mode-indicator').textContent = modeTitles[mode] || mode;
            
            // Apply mode-specific camera settings
            if (videoTrack) {
                try {
                    const capabilities = videoTrack.getCapabilities();
                    
                    switch (mode) {
                        case 'portrait':
                            // Set shallow depth of field if supported
                            if (capabilities.exposureMode) {
                                videoTrack.applyConstraints({
                                    advanced: [{ exposureMode: 'continuous' }]
                                });
                            }
                            break;
                            
                        case 'night':
                            // Increase exposure and ISO for night mode
                            if (capabilities.exposureMode) {
                                videoTrack.applyConstraints({
                                    advanced: [
                                        { exposureMode: 'manual' },
                                        { exposureTime: 33000 }, // Longer exposure
                                        { iso: capabilities.iso ? capabilities.iso.max : 0 }
                                    ]
                                });
                            }
                            break;
                            
                        case 'action':
                            // Fast shutter speed for action shots
                            if (capabilities.exposureTime) {
                                videoTrack.applyConstraints({
                                    advanced: [
                                        { exposureMode: 'manual' },
                                        { exposureTime: 8000 } // Fast shutter
                                    ]
                                });
                            }
                            break;
                            
                        default:
                            // Reset to auto settings
                            videoTrack.applyConstraints({
                                advanced: [{ exposureMode: 'continuous' }]
                            });
                    }
                } catch (e) {
                    console.log('Mode settings not supported:', e);
                }
            }
        }
        
        // Start the app
        initApp();
