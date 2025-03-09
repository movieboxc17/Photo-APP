document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const viewfinder = document.getElementById('viewfinder');
    const photoPreview = document.getElementById('photo-preview');
    const shutterButton = document.getElementById('shutter-button');
    const switchCameraButton = document.getElementById('switch-camera');
    const galleryButton = document.getElementById('gallery-button');
    const backToCameraButton = document.getElementById('back-to-camera');
    const togglePawModeButton = document.getElementById('toggle-paw-mode');
    const flashToggleButton = document.getElementById('flash-toggle');
    const hdrToggleButton = document.getElementById('hdr-toggle');
    const exposureControl = document.getElementById('exposure-control');
    const appContainer = document.querySelector('.app-container');
    const filterEffects = document.querySelectorAll('.filter-effect-preview');
    const modeOptions = document.querySelectorAll('.mode-option');
    const modeSelector = document.querySelector('.mode-selector');
    const photoGallery = document.getElementById('photo-gallery');
    const dynamicIndicator = document.querySelector('.dynamic-indicator');
    const notch = document.querySelector('.notch');
    const statusBar = document.querySelector('.status-bar');
    const stackCounter = document.querySelector('.stack-counter');
    const qualityIndicator = document.querySelector('.quality-indicator');
    
    // Screens
    const cameraScreen = document.getElementById('camera-screen');
    const galleryScreen = document.getElementById('gallery-screen');
    const editScreen = document.getElementById('edit-screen');

    // App state
    let stream = null;
    let facingMode = 'environment'; // 'environment' is back camera, 'user' is front camera
    let isPawMode = false;
    let isHDRActive = false;
    let currentMode = 'photo';
    let flashMode = 'off';
    let currentFilter = 'normal';
    let isTakingPhoto = false;
    let currentZoom = '1x';
    let savedPhotos = JSON.parse(localStorage.getItem('pawShotPhotos')) || [];
    
    // Enhanced Stack Mode Configuration
    const stackConfig = {
        framesCount: 15,       // Number of frames to capture
        quality: 'ultra',      // 'standard', 'high', 'ultra'
        processing: 'balanced',// 'fast', 'balanced', 'quality'
        alignment: 'auto',     // 'none', 'basic', 'auto'
        enhancementLevel: 2,   // 0: none, 1: moderate, 2: full
        superResolution: true, // Whether to apply super-resolution algorithms
        reduceNoise: true      // Whether to apply noise reduction
    };
    
    // Add Stack Mode Settings UI
    function initStackSettings() {
        const settingsPanel = document.createElement('div');
        settingsPanel.className = 'stack-settings';
        settingsPanel.innerHTML = `
            <div class="settings-drag-indicator"></div>
            <div class="stack-settings-header">
                <h3>Stack Mode Settings</h3>
                <button class="nav-button" id="close-stack-settings">Done</button>
            </div>
            <div class="stack-setting-group">
                <div class="stack-setting-title">Frames Count</div>
                <div class="stack-setting-options" data-setting="framesCount">
                    <div class="stack-setting-option ${stackConfig.framesCount === 5 ? 'active' : ''}" data-value="5">5</div>
                    <div class="stack-setting-option ${stackConfig.framesCount === 10 ? 'active' : ''}" data-value="10">10</div>
                    <div class="stack-setting-option ${stackConfig.framesCount === 15 ? 'active' : ''}" data-value="15">15</div>
                </div>
            </div>
            <div class="stack-setting-group">
                <div class="stack-setting-title">Quality</div>
                <div class="stack-setting-options" data-setting="quality">
                    <div class="stack-setting-option ${stackConfig.quality === 'standard' ? 'active' : ''}" data-value="standard">Standard</div>
                    <div class="stack-setting-option ${stackConfig.quality === 'high' ? 'active' : ''}" data-value="high">High</div>
                    <div class="stack-setting-option ${stackConfig.quality === 'ultra' ? 'active' : ''}" data-value="ultra">Ultra</div>
                </div>
            </div>
            <div class="stack-setting-group">
                <div class="stack-setting-title">Processing Style</div>
                <div class="stack-setting-options" data-setting="processing">
                    <div class="stack-setting-option ${stackConfig.processing === 'fast' ? 'active' : ''}" data-value="fast">Fast</div>
                    <div class="stack-setting-option ${stackConfig.processing === 'balanced' ? 'active' : ''}" data-value="balanced">Balanced</div>
                    <div class="stack-setting-option ${stackConfig.processing === 'quality' ? 'active' : ''}" data-value="quality">Quality</div>
                </div>
            </div>
            <div class="stack-setting-group">
                <div class="stack-setting-title">Super-Resolution</div>
                <div class="stack-setting-options" data-setting="superResolution">
                    <div class="stack-setting-option ${stackConfig.superResolution ? '' : 'active'}" data-value="false">Off</div>
                    <div class="stack-setting-option ${stackConfig.superResolution ? 'active' : ''}" data-value="true">On</div>
                </div>
            </div>
        `;
        document.body.appendChild(settingsPanel);
        
        // Stack settings event handlers
        document.querySelectorAll('.stack-setting-options').forEach(optionGroup => {
            optionGroup.querySelectorAll('.stack-setting-option').forEach(option => {
                option.addEventListener('click', () => {
                    const setting = optionGroup.dataset.setting;
                    const value = option.dataset.value;
                    
                    // Update active visual state
                    optionGroup.querySelectorAll('.stack-setting-option').forEach(opt => 
                        opt.classList.remove('active'));
                    option.classList.add('active');
                    
                    // Update stack config
                    if (setting === 'superResolution' || setting === 'reduceNoise') {
                        stackConfig[setting] = value === 'true';
                    } else if (setting === 'framesCount' || setting === 'enhancementLevel') {
                        stackConfig[setting] = parseInt(value);
                    } else {
                        stackConfig[setting] = value;
                    }
                    
                    // Show notification
                    showNotification(`Stack ${setting} set to ${value}`);
                    
                    // Update quality indicator if visible
                    updateQualityIndicator();
                });
            });
        });
        
        document.getElementById('close-stack-settings').addEventListener('click', () => {
            document.querySelector('.stack-settings').classList.remove('active');
        });
        
        // Long press on stack mode to open settings
        const stackModeOption = document.querySelector('.mode-option[data-mode="stack"]');
        let stackLongPressTimer;
        
        stackModeOption.addEventListener('touchstart', () => {
            stackLongPressTimer = setTimeout(() => {
                document.querySelector('.stack-settings').classList.add('active');
            }, 800);
        });
        
        stackModeOption.addEventListener('touchend', () => {
            clearTimeout(stackLongPressTimer);
        });
        
        // Add quality indicator to UI
        if (!document.querySelector('.quality-indicator')) {
            const qualityEl = document.createElement('div');
            qualityEl.className = 'quality-indicator';
            qualityEl.innerHTML = `
                <span class="quality-icon">⚡</span>
                <span class="quality-text">Ultra · 15 frames</span>
            `;
            viewfinder.parentElement.appendChild(qualityEl);
        }
    }
    
    function updateQualityIndicator() {
        const qualityIndicator = document.querySelector('.quality-indicator');
        if (!qualityIndicator) return;
        
        // Only show if in stack mode
        if (currentMode === 'stack') {
            qualityIndicator.classList.add('active');
            
            // Update text based on settings
            const qualityText = document.querySelector('.quality-text');
            qualityText.textContent = `${stackConfig.quality.charAt(0).toUpperCase() + stackConfig.quality.slice(1)} · ${stackConfig.framesCount} frames`;
            
            // Update icon color based on quality
            const qualityIcon = document.querySelector('.quality-icon');
            if (stackConfig.quality === 'ultra' && stackConfig.superResolution) {
                qualityIcon.style.color = '#34C759'; // Green
            } else if (stackConfig.quality === 'high') {
                qualityIcon.style.color = '#5AC8FA'; // Blue
            } else {
                qualityIcon.style.color = '#FFFFFF'; // White
            }
        } else {
            qualityIndicator.classList.remove('active');
        }
    }
    
    // Show notification toast
    function showNotification(message, duration = 2000) {
        let notification = document.querySelector('.app-notification');
        
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'app-notification';
            notification.innerHTML = `
                <div class="notification-icon">✓</div>
                <div class="notification-message"></div>
            `;
            document.body.appendChild(notification);
        }
        
        notification.querySelector('.notification-message').textContent = message;
        notification.classList.add('active');
        
        setTimeout(() => {
            notification.classList.remove('active');
        }, duration);
    }

    // Initialize camera
    async function initCamera() {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 3840 }, // 4K for better quality
                    height: { ideal: 2160 }
                }
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            viewfinder.srcObject = stream;
            
            // Apply current filter to viewfinder
            viewfinder.style.filter = getFilterStyle(currentFilter);
            
            // Wait for video to be ready
            await new Promise(resolve => {
                viewfinder.onloadedmetadata = () => {
                    viewfinder.play();
                    resolve();
                };
            });
            
            // Apply advanced camera settings if available
            const videoTrack = stream.getVideoTracks()[0];
            const capabilities = videoTrack.getCapabilities();
            const settings = {};
            
            // Apply improved defaults for better image quality
            if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
                settings.exposureMode = 'continuous';
            }
            
            if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
                settings.whiteBalanceMode = 'continuous';
            }
            
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                settings.focusMode = 'continuous';
            }
            
            // Apply HDR if available
            if (isHDRActive && capabilities.torch) {
                settings.torch = false; // Ensure torch is off for HDR
                if (capabilities.exposureCompensation) {
                    settings.exposureCompensation = capabilities.exposureCompensation.max / 2; 
                }
            }
            
            // Apply settings
            if (Object.keys(settings).length > 0) {
                try {
                    await videoTrack.applyConstraints({ advanced: [settings] });
                } catch (error) {
                    console.warn('Could not apply advanced camera settings:', error);
                }
            }
            
            // Show camera UI
            viewfinder.classList.remove('hidden');
            photoPreview.classList.add('hidden');
            
            // Update camera switch button visibility based on available cameras
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (videoDevices.length > 1) {
                switchCameraButton.style.display = 'flex';
            } else {
                switchCameraButton.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            showNotification('Camera access error: ' + error.message, 3000);
        }
    }
    
    // Enhanced Take Photo Function
    async function takePhoto() {
        if (isTakingPhoto) return;
        isTakingPhoto = true;
        
        // Animate shutter button
        shutterButton.style.transform = 'scale(0.9)';
        setTimeout(() => {
            shutterButton.style.transform = 'scale(1)';
        }, 200);
        
        // Flash effect if flash is enabled or auto and environment is dark
        let useFlash = false;
        if (flashMode === 'on' || (flashMode === 'auto' && isEnvironmentDark())) {
            useFlash = true;
            
            // Create flash overlay
            const flashOverlay = document.createElement('div');
            flashOverlay.style.position = 'absolute';
            flashOverlay.style.top = '0';
            flashOverlay.style.left = '0';
            flashOverlay.style.width = '100%';
            flashOverlay.style.height = '100%';
            flashOverlay.style.backgroundColor = 'white';
            flashOverlay.style.opacity = '0';
            flashOverlay.style.transition = 'opacity 0.1s ease-in-out';
            flashOverlay.style.zIndex = '9999';
            
            document.body.appendChild(flashOverlay);
            
            // Animate flash
            setTimeout(() => {
                flashOverlay.style.opacity = '1';
                setTimeout(() => {
                    flashOverlay.style.opacity = '0';
                    setTimeout(() => {
                        flashOverlay.remove();
                    }, 100);
                }, 100);
            }, 0);
            
            // Try to use device torch if available
            try {
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack.getCapabilities().torch) {
                    await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
                    
                    // Turn off torch after capturing
                    setTimeout(async () => {
                        await videoTrack.applyConstraints({ advanced: [{ torch: false }] });
                    }, 500);
                }
            } catch (error) {
                console.warn('Could not use device torch:', error);
            }
        }
        
        // Show animation indicator in dynamic island
        dynamicIndicator.classList.add('recording');
        notch.classList.add('active');
        
        // Different photo capture based on mode
        if (currentMode === 'stack') {
            await captureStackedPhoto();
        } else if (currentMode === 'portrait') {
            await capturePortraitModePhoto();
        } else {
            await captureStandardPhoto();
        }
        
        // Reset indicators
        dynamicIndicator.classList.remove('recording');
        notch.classList.remove('active');
    }
    
    // Enhanced Image Stacking for higher quality results
    async function captureStackedPhoto() {
        const stackProgress = document.createElement('div');
        stackProgress.className = 'stack-progress';
        stackProgress.innerHTML = `
            <div class="stack-indicator"></div>
            <div class="stack-status">Capturing Frames</div>
            <div class="stack-details">Hold still for best quality</div>
        `;
        viewfinder.parentElement.appendChild(stackProgress);
        
        // Show stack progress
        setTimeout(() => {
            stackProgress.classList.add('active');
        }, 0);
        
        // Update counter
        stackCounter.classList.add('active');
        
        // Capture frames
        const frames = [];
        const frameCount = stackConfig.framesCount;
        let currentFrame = 0;
        
        // Start time for performance tracking
        const startTime = performance.now();
        
        async function captureFrame() {
            // Create canvas to capture frame
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Use higher resolution for better quality
            const width = viewfinder.videoWidth;
            const height = viewfinder.videoHeight;
            canvas.width = width;
            canvas.height = height;
            
            // Draw current frame
            ctx.drawImage(viewfinder, 0, 0, width, height);
            
            // Apply filter if needed
            if (currentFilter !== 'normal') {
                // Create filtered version
                const filteredCanvas = document.createElement('canvas');
                filteredCanvas.width = width;
                filteredCanvas.height = height;
                const filteredCtx = filteredCanvas.getContext('2d');
                
                // Draw original with filter
                filteredCtx.filter = getFilterStyle(currentFilter);
                filteredCtx.drawImage(canvas, 0, 0);
                
                // Save filtered frame
                frames.push({
                    data: filteredCanvas,
                    time: performance.now() - startTime
                });
            } else {
                // Save original frame
                frames.push({
                    data: canvas,
                    time: performance.now() - startTime
                });
            }
            
            // Update progress
            currentFrame++;
            
            // Update UI
            stackProgress.querySelector('.stack-status').textContent = 
                `Capturing ${currentFrame}/${frameCount}`;
            stackProgress.querySelector('.stack-details').textContent = 
                `${Math.round((currentFrame / frameCount) * 100)}% complete`;
            
            // Update counter with visual feedback
            const counterText = document.querySelector('.stack-counter span');
            if (counterText) {
                counterText.textContent = `${currentFrame}/${frameCount}`;
            }
            
            // Continue capturing frames or process if done
            if (currentFrame < frameCount) {
                // Wait for a short delay between captures to capture different frames
                // Adaptive delay based on device performance
                const adaptiveDelay = stackConfig.processing === 'fast' ? 30 : 
                                     (stackConfig.processing === 'balanced' ? 50 : 80);
                                     
                setTimeout(captureFrame, adaptiveDelay);
            } else {
                // All frames captured, now process them
                stackProgress.querySelector('.stack-status').textContent = 'Processing';
                stackProgress.querySelector('.stack-details').textContent = 
                    'Aligning and enhancing images...';
                
                // Small delay to show the processing message
                setTimeout(() => {
                    processStackedFrames(frames, stackProgress);
                }, 100);
            }
        }
        
        // Start capturing frames
        captureFrame();
    }
    
    // Process and combine stacked frames for higher quality results
    async function processStackedFrames(frames, stackProgress) {
        // Update UI
        stackProgress.querySelector('.stack-status').textContent = 'Aligning Frames';
        
        // Create final canvas for stacked result
        const firstFrame = frames[0].data;
        let width = firstFrame.width;
        let height = firstFrame.height;
        
        // If super-resolution is enabled, increase output resolution
        if (stackConfig.superResolution) {
            // Increase resolution by 1.5x or 2x based on quality setting
            const scaleFactor = stackConfig.quality === 'ultra' ? 2.0 : 
                              (stackConfig.quality === 'high' ? 1.5 : 1.0);
                              
            width = Math.round(width * scaleFactor);
            height = Math.round(height * scaleFactor);
            
            stackProgress.querySelector('.stack-details').textContent = 
                `Generating ${width}x${height} image`;
        }
        
        // Create final canvas
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const finalCtx = finalCanvas.getContext('2d');
        
        // STEP 1: Image Registration (Alignment)
        stackProgress.querySelector('.stack-status').textContent = 'Aligning Images';
        const alignedFrames = await alignFrames(frames, stackConfig.alignment);
        
        // STEP 2: Exposure fusion or HDR if enabled
        stackProgress.querySelector('.stack-status').textContent = 'Combining Exposures';
        stackProgress.querySelector('.stack-details').textContent = 
            isHDRActive ? 'Creating HDR image...' : 'Fusing exposures...';
        
        // Apply exposure fusion method
        await fuseExposures(alignedFrames, finalCtx, width, height);
        
        // STEP 3: Apply noise reduction if enabled
        if (stackConfig.reduceNoise) {
            stackProgress.querySelector('.stack-status').textContent = 'Reducing Noise';
            await reduceNoise(finalCanvas, finalCtx);
        }
        
        // STEP 4: Apply paw effect if in paw mode
        if (isPawMode) {
            stackProgress.querySelector('.stack-status').textContent = 'Adding Paw Effects';
            applyPawEffect(finalCtx, width, height);
        }
        
        // STEP 5: Finalize and enhance
        stackProgress.querySelector('.stack-status').textContent = 'Enhancing Details';
        stackProgress.querySelector('.stack-details').textContent = 'Adding final touches...';
        
        // Apply final sharpening and enhancement
        enhanceImageDetails(finalCanvas, finalCtx, stackConfig.enhancementLevel);
        
        // Add subtle vignette for professional look
        addVignette(finalCtx, width, height);
        
        // Final optimization
        stackProgress.querySelector('.stack-status').textContent = 'Saving Image';
        
        // Show final result
        const photoDataUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
        
        // Save to gallery
        const newPhoto = {
            id: Date.now(),
            src: photoDataUrl,
            date: new Date().toISOString(),
            filter: currentFilter,
            pawMode: isPawMode,
            mode: 'stack',
            resolution: `${width}x${height}`,
            quality: stackConfig.quality,
            frameCount: frames.length
        };
        
        savedPhotos.unshift(newPhoto);
        localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
        
        // Show success notification
        showNotification(`Stack ${stackConfig.quality} photo saved!`);
        
        // Preview animation
        photoPreview.width = finalCanvas.width;
        photoPreview.height = finalCanvas.height;
        const previewCtx = photoPreview.getContext('2d');
        previewCtx.drawImage(finalCanvas, 0, 0);
        
        viewfinder.classList.add('hidden');
        photoPreview.classList.remove('hidden');
        
        // Show stack complete animation
        photoPreview.classList.add('stack-complete');
        setTimeout(() => {
            photoPreview.classList.remove('stack-complete');
        }, 500);
        
        // Remove progress and reset UI elements
        stackProgress.classList.remove('active');
        setTimeout(() => {
            stackProgress.remove();
        }, 300);
        
        stackCounter.classList.remove('active');
        
        // Return to viewfinder after preview
        setTimeout(() => {
            viewfinder.classList.remove('hidden');
            photoPreview.classList.add('hidden');
            isTakingPhoto = false;
        }, 2000);
        
        // Update gallery
        renderGallery();
    }
    
    // Align frames for better stacking (simplified image registration)
    async function alignFrames(frames, alignmentMode) {
        if (alignmentMode === 'none') return frames;
        
        const baseFrame = frames[0].data;
        const alignedFrames = [frames[0]]; // Keep first frame as reference
        
        for (let i = 1; i < frames.length; i++) {
            const frame = frames[i];
            
            // For demo purposes, we'll simulate alignment
            // In a real app, this would use complex image registration algorithms
            
            // Create aligned canvas
            const alignedCanvas = document.createElement('canvas');
            alignedCanvas.width = baseFrame.width;
            alignedCanvas.height = baseFrame.height;
            const alignedCtx = alignedCanvas.getContext('2d');
            
            // Basic alignment - in real app would compute actual offsets using feature detection
            // For now we'll add some time-based slight shifts to simulate motion compensation
            const timeOffset = frame.time - frames[0].time;
            const maxShift = alignmentMode === 'auto' ? 4 : 2;
            
                        // Simulate small motion correction based on time between frames
            // This creates slightly different alignments for each frame
            const xShift = Math.sin(timeOffset / 100) * maxShift;
            const yShift = Math.cos(timeOffset / 120) * maxShift;
            
            // Draw with offset to simulate alignment correction
            alignedCtx.drawImage(frame.data, xShift, yShift);
            
            // Replace frame data with aligned data
            alignedFrames.push({
                data: alignedCanvas,
                time: frame.time
            });
        }
        
        return alignedFrames;
    }
    
    // Fuse multiple exposures for better dynamic range
    async function fuseExposures(frames, finalCtx, width, height) {
        // For an actual implementation, this would use exposure fusion or HDR merging algorithms
        // For this demo, we'll use a weighted average approach that simulates exposure fusion
        
        // Prepare intermediate canvas for blending
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw base frame at target resolution
        tempCtx.drawImage(frames[0].data, 0, 0, width, height);
        
        // Set base image as starting point
        finalCtx.drawImage(tempCanvas, 0, 0);
        
        // Process each additional frame with different weights
        // Algorithm simulates a weighted average with more weight toward well-exposed regions
        for (let i = 1; i < frames.length; i++) {
            const frame = frames[i];
            
            // Adjust opacity based on frame position (later frames have less influence)
            // This simulates a temporal weighting function
            const blendOpacity = Math.max(0.2, 1 - (i / frames.length));
            
            // For demo purposes, we simulate different exposure weights
            // Real algorithms would analyze each pixel region and determine optimal weights
            tempCtx.globalAlpha = blendOpacity;
            tempCtx.clearRect(0, 0, width, height);
            tempCtx.drawImage(frame.data, 0, 0, width, height);
            
            // Progressive blending
            finalCtx.globalAlpha = isHDRActive ? 0.3 : 0.2;
            finalCtx.drawImage(tempCanvas, 0, 0);
        }
        
        // Reset alpha
        finalCtx.globalAlpha = 1.0;
        
        // If HDR is active, apply tone mapping simulation
        if (isHDRActive) {
            applyHDREffect(finalCtx, width, height);
        }
        
        return true;
    }
    
    // Apply HDR tone mapping effect
    function applyHDREffect(ctx, width, height) {
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Apply a simplified tone mapping algorithm
        // This simulates HDR by enhancing shadows and recovering highlights
        for (let i = 0; i < data.length; i += 4) {
            // Get RGB values
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Enhance shadows (bring up dark areas)
            if (r < 80) r = Math.pow(r / 80, 0.8) * 80;
            if (g < 80) g = Math.pow(g / 80, 0.8) * 80;
            if (b < 80) b = Math.pow(b / 80, 0.8) * 80;
            
            // Recover highlights (prevent blowout)
            if (r > 200) r = 200 + (r - 200) * 0.8;
            if (g > 200) g = 200 + (g - 200) * 0.8;
            if (b > 200) b = 200 + (b - 200) * 0.8;
            
            // Update pixel values
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
        
        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);
    }
    
    // Apply noise reduction
    async function reduceNoise(canvas, ctx) {
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply a simplified noise reduction algorithm
        // For demo purposes, we'll use a simple 3x3 median filter simulation
        // Real implementation would use more sophisticated algorithms
        
        // For every 10th pixel to speed up the demo (would process all pixels in a real app)
        for (let i = 0; i < data.length; i += 40) {
            // Simple smoothing
            if (i % 4 === 0 && i > canvas.width * 4 * 1 && i < data.length - canvas.width * 4 * 1) {
                // Only process every few pixels for demo speed
                // Get surrounding pixels average (simplified)
                const offset = 4; // one pixel in each direction
                
                // Calculate average of surrounding pixels (simplified)
                let avgR = (data[i - offset] + data[i + offset]) / 2;
                let avgG = (data[i + 1 - offset] + data[i + 1 + offset]) / 2;
                let avgB = (data[i + 2 - offset] + data[i + 2 + offset]) / 2;
                
                // Apply limited smoothing to avoid over-blurring (only reduce noise)
                // Only smooth if current pixel appears to be noise (differs significantly from neighbors)
                const diffR = Math.abs(data[i] - avgR);
                const diffG = Math.abs(data[i + 1] - avgG);
                const diffB = Math.abs(data[i + 2] - avgB);
                
                // If pixel differs substantially from neighbors, it might be noise
                if (diffR > 20 || diffG > 20 || diffB > 20) {
                    // Blend toward average (smoothing)
                    data[i] = data[i] * 0.7 + avgR * 0.3;
                    data[i + 1] = data[i + 1] * 0.7 + avgG * 0.3;
                    data[i + 2] = data[i + 2] * 0.7 + avgB * 0.3;
                }
            }
        }
        
        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);
    }
    
    // Apply paw theme effect
    function applyPawEffect(ctx, width, height) {
        // Add warm filter effect
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Warm, slightly pink tint for Paw Mode
        for (let i = 0; i < data.length; i += 4) {
            // Enhance red and green slightly for warm effect
            data[i] = Math.min(255, data[i] * 1.1);           // Red
            data[i + 1] = Math.min(255, data[i + 1] * 1.02);  // Green
            data[i + 2] = Math.max(0, data[i + 2] * 0.9);     // Reduce blue
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Add paw prints in corners
        const pawSize = Math.min(width, height) * 0.15;
        
        // Add decorative paw prints around the edges
        drawPawPrint(ctx, pawSize, pawSize, pawSize * 0.7);
        drawPawPrint(ctx, width - pawSize, pawSize, pawSize * 0.7);
        drawPawPrint(ctx, pawSize, height - pawSize, pawSize * 0.7);
        drawPawPrint(ctx, width - pawSize, height - pawSize, pawSize * 0.7);
        
        // Add subtle vignette for paw mode
        ctx.fillStyle = 'rgba(255, 105, 180, 0.1)';
        ctx.fillRect(0, 0, width, height);
        
        // Draw gradient vignette
        const gradient = ctx.createRadialGradient(
            width/2, height/2, Math.min(width, height) * 0.4,
            width/2, height/2, Math.min(width, height) * 0.7
        );
        gradient.addColorStop(0, 'rgba(255, 105, 180, 0)');
        gradient.addColorStop(1, 'rgba(255, 105, 180, 0.15)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    // Draw a paw print
    function drawPawPrint(ctx, x, y, size) {
        ctx.fillStyle = 'rgba(255, 105, 180, 0.3)';
        
        // Main pad
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.15, size * 0.4, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Toe beans (4 small circles)
        const toeSize = size * 0.2;
        ctx.beginPath();
        ctx.ellipse(x - size * 0.2, y - size * 0.15, toeSize, toeSize, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(x + size * 0.2, y - size * 0.15, toeSize, toeSize, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(x - size * 0.35, y - size * 0.32, toeSize, toeSize, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(x + size * 0.35, y - size * 0.32, toeSize, toeSize, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Enhance image details
    function enhanceImageDetails(canvas, ctx, level) {
        if (level === 0) return; // No enhancement requested
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Apply detail enhancement (simplified unsharp mask)
        // Process every nth pixel for demo performance (real app would process all)
        const step = level === 2 ? 4 : 8;
        
        for (let y = 1; y < canvas.height - 1; y += step) {
            for (let x = 1; x < canvas.width - 1; x += step) {
                const idx = (y * canvas.width + x) * 4;
                
                // Calculate local contrast (simplified edge detection)
                // Get adjacent pixels
                const idxLeft = (y * canvas.width + (x - 1)) * 4;
                const idxRight = (y * canvas.width + (x + 1)) * 4;
                const idxUp = ((y - 1) * canvas.width + x) * 4;
                const idxDown = ((y + 1) * canvas.width + x) * 4;
                
                // Calculate average difference with adjacent pixels
                const rDiff = Math.abs(data[idx] - (data[idxLeft] + data[idxRight] + data[idxUp] + data[idxDown]) / 4);
                const gDiff = Math.abs(data[idx + 1] - (data[idxLeft + 1] + data[idxRight + 1] + data[idxUp + 1] + data[idxDown + 1]) / 4);
                const bDiff = Math.abs(data[idx + 2] - (data[idxLeft + 2] + data[idxRight + 2] + data[idxUp + 2] + data[idxDown + 2]) / 4);
                
                // Enhance edges
                const enhanceFactor = level === 2 ? 0.4 : 0.2; // Adjust based on enhancement level
                if (rDiff > 5) data[idx] = Math.min(255, data[idx] + rDiff * enhanceFactor);
                if (gDiff > 5) data[idx + 1] = Math.min(255, data[idx + 1] + gDiff * enhanceFactor);
                if (bDiff > 5) data[idx + 2] = Math.min(255, data[idx + 2] + bDiff * enhanceFactor);
            }
        }
        
        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);
    }
    
    // Add a subtle vignette for professional look
    function addVignette(ctx, width, height) {
        const gradient = ctx.createRadialGradient(
            width/2, height/2, Math.min(width, height) * 0.5,
            width/2, height/2, Math.min(width, height) * 0.9
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over'; // Reset
    }
    
    // Detect if environment is dark based on video analysis
    function isEnvironmentDark() {
        try {
            // Create a small canvas for quick analysis
            const sampleCanvas = document.createElement('canvas');
            const sampleCtx = sampleCanvas.getContext('2d');
            sampleCanvas.width = 50;
            sampleCanvas.height = 50;
            
            // Sample the center of the viewfinder
            sampleCtx.drawImage(
                viewfinder, 
                viewfinder.videoWidth / 2 - 25, 
                viewfinder.videoHeight / 2 - 25, 
                50, 50, 
                0, 0, 50, 50
            );
            
            // Get pixel data
            const imageData = sampleCtx.getImageData(0, 0, 50, 50);
            const data = imageData.data;
            
            // Calculate average brightness
            let totalBrightness = 0;
            for (let i = 0; i < data.length; i += 4) {
                // Weighted RGB to brightness (human eye sensitivity)
                totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            }
            
            const avgBrightness = totalBrightness / (data.length / 4);
            
            // Consider environment dark if average brightness is below threshold
            return avgBrightness < 60; // Threshold from 0-255
        } catch (error) {
            console.warn('Error analyzing brightness:', error);
            return false;
        }
    }
    
    // Capture standard photo
    async function captureStandardPhoto() {
        // Create canvas to capture frame
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Use native resolution for best quality
        canvas.width = viewfinder.videoWidth;
        canvas.height = viewfinder.videoHeight;
        
        // Draw current frame
        ctx.drawImage(viewfinder, 0, 0);
        
        // Apply current filter
        if (currentFilter !== 'normal') {
            ctx.filter = getFilterStyle(currentFilter);
            ctx.drawImage(canvas, 0, 0);
            ctx.filter = 'none';
        }
        
        // Apply paw effect if in paw mode
        if (isPawMode) {
            applyPawEffect(ctx, canvas.width, canvas.height);
        }
        
        // Convert to data URL
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        
        // Save to gallery
        const newPhoto = {
            id: Date.now(),
            src: photoDataUrl,
            date: new Date().toISOString(),
            filter: currentFilter,
            pawMode: isPawMode,
            mode: currentMode
        };
        
        savedPhotos.unshift(newPhoto);
        localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
        
        // Show notification
        showNotification('Photo saved to gallery');
        
        // Preview photo briefly
        photoPreview.width = canvas.width;
        photoPreview.height = canvas.height;
        const previewCtx = photoPreview.getContext('2d');
        previewCtx.drawImage(canvas, 0, 0);
        
        viewfinder.classList.add('hidden');
        photoPreview.classList.remove('hidden');
        
        // Return to viewfinder after preview
        setTimeout(() => {
            viewfinder.classList.remove('hidden');
            photoPreview.classList.add('hidden');
            isTakingPhoto = false;
        }, 1500);
        
        // Update gallery
        renderGallery();
    }
    
    // Capture portrait mode photo with depth effect
    async function capturePortraitModePhoto() {
        // Show processing indicator
        const stackProgress = document.createElement('div');
        stackProgress.className = 'stack-progress';
        stackProgress.innerHTML = `
            <div class="stack-indicator"></div>
            <div class="stack-status">Portrait Mode</div>
            <div class="stack-details">Creating depth effect...</div>
        `;
        viewfinder.parentElement.appendChild(stackProgress);
        
        // Show stack progress
        setTimeout(() => {
            stackProgress.classList.add('active');
        }, 0);
        
        // Create canvas for original photo
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Use native resolution
        canvas.width = viewfinder.videoWidth;
        canvas.height = viewfinder.videoHeight;
        
        // Draw current frame
        ctx.drawImage(viewfinder, 0, 0);
        
        // Store original pixels
        const originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Simulate depth map creation (in a real app, this would use ML to detect subject)
        stackProgress.querySelector('.stack-status').textContent = 'Analyzing Depth';
        
        // Simulate depth analysis delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Apply portrait mode blur effect
        stackProgress.querySelector('.stack-status').textContent = 'Applying Depth Effect';
        
        // Create circular gradient to simulate portrait mode (center in focus, edges blurred)
        // This is a simplified version - a real app would use ML to detect subjects
        
        // Draw original image
        ctx.putImageData(originalImageData, 0, 0);
        
        // Apply filter if needed
        if (currentFilter !== 'normal') {
            ctx.filter = getFilterStyle(currentFilter);
            ctx.drawImage(canvas, 0, 0);
            ctx.filter = 'none';
        }
        
        // Create blurred background layer
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = canvas.width;
        blurCanvas.height = canvas.height;
        const blurCtx = blurCanvas.getContext('2d');
        
        // Draw and blur the original (CSS blur for simplicity, could use more advanced algorithm)
        blurCtx.filter = 'blur(12px)';
        blurCtx.drawImage(canvas, 0, 0);
        blurCtx.filter = 'none';
        
        // Create gradient mask for transition from sharp to blurred
        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = canvas.width;
        gradientCanvas.height = canvas.height;
        const gradientCtx = gradientCanvas.getContext('2d');
        
        // Create radial gradient (center in focus, edges blurred)
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.35;
        
        const gradient = gradientCtx.createRadialGradient(
            centerX, centerY, radius, 
            centerX, centerY, radius * 2
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');    // Center (keep original)
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');    // Edges (use blur)
        
        gradientCtx.fillStyle = gradient;
        gradientCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Composite original and blurred using the gradient mask
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(gradientCanvas, 0, 0);
        ctx.restore();
        
        // Now draw the blurred version where we've cut out
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(blurCanvas, 0, 0);
        ctx.restore();
        
        // Apply paw effect if in paw mode
        if (isPawMode) {
            applyPawEffect(ctx, canvas.width, canvas.height);
        }
        
        // Add subtle vignette for professional look
        addVignette(ctx, canvas.width, canvas.height);
        
        // Convert to data URL
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        
        // Remove progress indicator
        stackProgress.classList.remove('active');
        setTimeout(() => {
            stackProgress.remove();
        }, 300);
        
        // Save to gallery
        const newPhoto = {
            id: Date.now(),
            src: photoDataUrl,
            date: new Date().toISOString(),
            filter: currentFilter,
            pawMode: isPawMode,
            mode: 'portrait'
        };
        
        savedPhotos.unshift(newPhoto);
        localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
        
        // Show notification
        showNotification('Portrait photo saved');
        
        // Preview photo briefly
        photoPreview.width = canvas.width;
        photoPreview.height = canvas.height;
        const previewCtx = photoPreview.getContext('2d');
        previewCtx.drawImage(canvas, 0, 0);
        
        viewfinder.classList.add('hidden');
        photoPreview.classList.remove('hidden');
        
        // Return to viewfinder after preview
        setTimeout(() => {
            viewfinder.classList.remove('hidden');
            photoPreview.classList.add('hidden');
            isTakingPhoto = false;
        }, 1500);
        
        // Update gallery
        renderGallery();
    }
    
    // Get CSS filter style based on filter name
    function getFilterStyle(filterName) {
        const filters = {
            'normal': 'none',
            'mono': 'grayscale(1)',
            'noir': 'grayscale(1) contrast(1.5) brightness(0.8)',
            'fade': 'sepia(0.3) brightness(1.1) contrast(0.9)',
            'chrome': 'saturate(1.3) contrast(1.1)',
            'process': 'sepia(0.4) saturate(1.8) contrast(0.9)',
            'instant': 'sepia(0.4) contrast(1.2) brightness(1.1)',
            'warm': 'sepia(0.3) saturate(1.3) contrast(0.9)',
            'cool': 'saturate(0.8) hue-rotate(30deg)',
            'vivid': 'saturate(1.5) contrast(1.2)',
            'paws': 'sepia(0.1) saturate(1.3) hue-rotate(-10deg) brightness(1.05)'
        };
        
        return filters[filterName] || 'none';
    }
    
    // Render gallery images
    function renderGallery() {
        // Clear existing gallery
        const galleryGrid = document.querySelector('.gallery-grid');
        galleryGrid.innerHTML = '';
        
        if (savedPhotos.length === 0) {
            // Show empty state
            galleryGrid.innerHTML = `
                <div class="empty-gallery">
                    <div class="empty-gallery-icon">📷</div>
                    <div class="empty-gallery-text">No Photos Yet</div>
                    <div class="empty-gallery-subtext">Photos you take will appear here</div>
                </div>
            `;
            return;
        }
        
        // Add each photo to gallery
        savedPhotos.forEach(photo => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            
            const img = document.createElement('img');
            img.src = photo.src;
            img.alt = 'Gallery photo';
            
            // Add badge for special modes
            if (photo.mode === 'stack' || photo.mode === 'portrait') {
                const badge = document.createElement('span');
                badge.className = 'photo-badge';
                badge.textContent = photo.mode === 'stack' ? 'STACK' : 'PORTRAIT';
                photoItem.appendChild(badge);
            }
            
            photoItem.appendChild(img);
            
            // Open photo in edit view when clicked
            photoItem.addEventListener('click', () => {
                openPhotoInEditView(photo);
            });
            
            galleryGrid.appendChild(photoItem);
        });
    }
    
    // Open photo in edit view
    function openPhotoInEditView(photo) {
        const editImage = document.getElementById('edit-image');
        editImage.src = photo.src;
        
        // Show edit screen
        cameraScreen.classList.add('hidden');
        galleryScreen.classList.add('hidden');
        editScreen.classList.remove('hidden');
        
        // Store reference to current photo
        editScreen.dataset.photoId = photo.id;
    }
    
    // Initialize the camera when page loads
    initCamera();
    
    // Initialize stack settings
    initStackSettings();
    
    // Event listeners
    shutterButton.addEventListener('click', takePhoto);
    
    switchCameraButton.addEventListener('click', () => {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        initCamera();
    });
    
    galleryButton.addEventListener('click', () => {
        cameraScreen.classList.add('hidden');
        galleryScreen.classList.remove('hidden');
        renderGallery();
    });
    
    backToCameraButton.addEventListener('click', () => {
        galleryScreen.classList.add('hidden');
        cameraScreen.classList.remove('hidden');
    });
    
    document.getElementById('back-to-gallery').addEventListener('click', () => {
        editScreen.classList.add('hidden');
        galleryScreen.classList.remove('hidden');
    });
    
    document.getElementById('delete-photo').addEventListener('click', () => {
        const photoId = parseInt(editScreen.dataset.photoId);
        
        // Remove photo from saved photos
        savedPhotos = savedPhotos.filter(photo => photo.id !== photoId);
        localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
        
        // Show notification
        showNotification('Photo deleted');
        
        // Return to gallery
        editScreen.classList.add('hidden');
        galleryScreen.classList.remove('hidden');
        renderGallery();
    });
    
    // Toggle paw mode
    togglePawModeButton.addEventListener('click', () => {
        isPawMode = !isPawMode;
        appContainer.classList.toggle('paw-mode', isPawMode);
        
        if (isPawMode) {
            // Show paw prints effect
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const pawPrint = document.createElement('div');
                    pawPrint.className = 'paw-print';
                    
                    // Random position within viewport
                    const x = Math.random() * window.innerWidth;
                    const y = Math.random() * window.innerHeight;
                    
                    pawPrint.style.left = `${x}px`;
                    pawPrint.style.top = `${y}px`;
                    
                    document.body.appendChild(pawPrint);
                    
                    // Fade in
                    setTimeout(() => {
                        pawPrint.style.opacity = '0.8';
                    }, 10);
                    
                    // Remove after animation
                    setTimeout(() => {
                        pawPrint.style.opacity = '0';
                        setTimeout(() => {
                            pawPrint.remove();
                        }, 500);
                    }, 2000);
                }, i * 300);
            }
            
            showNotification('Paw Mode activated!');
        } else {
            showNotification('Paw Mode deactivated');
        }
    });
    
    // Mode selector (photo, portrait, stack)
    modeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const mode = option.dataset.mode;
            
            // Update active class
            modeOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            // Update current mode
            currentMode = mode;
            
            // Move the active indicator
            const activeIndex = Array.from(modeOptions).findIndex(opt => opt === option);
            const indicatorPosition = (activeIndex * 100) + 'px';
            document.documentElement.style.setProperty('--active-indicator-position', indicatorPosition);
            
            // Show appropriate UI for the mode
            if (mode === 'stack') {
                stackCounter.classList.add('visible');
                stackCounter.querySelector('span').textContent = `0/${stackConfig.framesCount}`;
                updateQualityIndicator();
            } else {
                stackCounter.classList.remove('visible');
                document.querySelector('.quality-indicator').classList.remove('active');
            }
            
            // Show feedback
            showNotification(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode activated`);
        });
    });
    
    // Flash toggle
    flashToggleButton.addEventListener('click', () => {
        // Cycle through flash modes: off -> auto -> on -> off
        const modes = ['off', 'auto', 'on'];
        const currentIndex = modes.indexOf(flashMode);
        flashMode = modes[(currentIndex + 1) % modes.length];
        
        // Update UI
        flashToggleButton.innerHTML = `
            <span class="material-icons-round">
                ${flashMode === 'off' ? 'flash_off' : flashMode === 'auto' ? 'flash_auto' : 'flash_on'}
            </span>
        `;
        
        showNotification(`Flash: ${flashMode}`);
    });
    
    // HDR toggle
    hdrToggleButton.addEventListener('click', () => {
        isHDRActive = !isHDRActive;
        
        // Update UI
        hdrToggleButton.classList.toggle('active', isHDRActive);
        
        showNotification(`HDR: ${isHDRActive ? 'On' : 'Off'}`);
    });
    
    // Filter effects
    filterEffects.forEach(effect => {
        effect.addEventListener('click', () => {
            const filter = effect.dataset.filter;
            
            // Update active class
            filterEffects.forEach(ef => ef.classList.remove('active'));
            effect.classList.add('active');
            
            // Update current filter
            currentFilter = filter;
            
            // Apply filter to viewfinder
            viewfinder.style.filter = getFilterStyle(filter);
            
            // Show feedback
            showNotification(`Filter: ${filter.charAt(0).toUpperCase() + filter.slice(1)}`);
        });
    });
    
    // Exposure control
    let startY = 0;
    let initialExposure = 1.0;
    
    exposureControl.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        
        // Show exposure indicator
        document.querySelector('.exposure-indicator').classList.add('active');
    });
    
    exposureControl.addEventListener('touchmove', (e) => {
        const diffY = startY - e.touches[0].clientY;
        const newExposure = Math.max(0.5, Math.min(1.5, initialExposure + (diffY / 200)));
        
        // Apply brightness to viewfinder
        viewfinder.style.filter = `${getFilterStyle(currentFilter)} brightness(${newExposure})`;
        
        // Update exposure indicator
        const indicator = document.querySelector('.exposure-indicator');
        const value = Math.round((newExposure - 1) * 100);
        indicator.textContent = value > 0 ? `+${value}` : value;
        
        // Update color based on value
        if (value > 10) {
            indicator.style.color = '#FFD700'; // Gold for bright
        } else if (value < -10) {
            indicator.style.color = '#3498DB'; // Blue for dark
        } else {
            indicator.style.color = '#FFFFFF'; // White for neutral
        }
    });
    
    exposureControl.addEventListener('touchend', () => {
        // Hide exposure indicator after delay
        setTimeout(() => {
            document.querySelector('.exposure-indicator').classList.remove('active');
        }, 1000);
    });
    
    // Zoom controls
    const zoomOptions = document.querySelectorAll('.zoom-option');
    
    zoomOptions.forEach(option => {
        option.addEventListener('click', () => {
            const zoom = option.dataset.zoom;
            
            // Update active class
            zoomOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            // Update current zoom
            currentZoom = zoom;
            
            // Apply zoom to viewfinder
            const zoomValue = zoom === '0.5x' ? 0.5 : zoom === '1x' ? 1 : zoom === '2x' ? 2 : 3;
            viewfinder.style.transform = `scale(${zoomValue})`;
            
            // Update video constraints if supported
            try {
                const videoTrack = stream.getVideoTracks()[0];
                const capabilities = videoTrack.getCapabilities();
                
                if (capabilities.zoom) {
                    const min = capabilities.zoom.min;
                    const max = capabilities.zoom.max;
                    const zoomLevel = min + ((max - min) * (zoomValue - 0.5) / 2.5);
                    
                    videoTrack.applyConstraints({
                        advanced: [{ zoom: zoomLevel }]
                    });
                }
            } catch (error) {
                console.warn('Could not apply zoom:', error);
            }
            
            // Show feedback
            showNotification(`Zoom: ${zoom}`);
        });
    });
    
    // Add swipe gesture for mode selector
    let touchStartX = 0;
    let touchEndX = 0;
    
    modeSelector.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    });
    
    modeSelector.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        handleSwipeGesture();
    });
    
    function handleSwipeGesture() {
        const threshold = 50; // Minimum distance for swipe
        
        if (touchStartX - touchEndX > threshold) {
            // Swipe left - go to next mode
            const activeOption = document.querySelector('.mode-option.active');
            const nextOption = activeOption.nextElementSibling;
            
            if (nextOption && nextOption.classList.contains('mode-option')) {
                nextOption.click();
            }
        } else if (touchEndX - touchStartX > threshold) {
            // Swipe right - go to previous mode
            const activeOption = document.querySelector('.mode-option.active');
            const prevOption = activeOption.previousElementSibling;
            
            if (prevOption && prevOption.classList.contains('mode-option')) {
                prevOption.click();
            }
        }
    }
    
    // Handle screen orientation changes
    window.addEventListener('orientationchange', () => {
        // Allow time for orientation to complete
        setTimeout(() => {
            // Stop and restart camera to adjust to new orientation
            initCamera();
        }, 300);
    });
    
    // Share photo
    document.getElementById('share-photo').addEventListener('click', () => {
        const photoId = parseInt(editScreen.dataset.photoId);
        const photo = savedPhotos.find(p => p.id === photoId);
        
        if (photo && navigator.share) {
            // Convert base64 to blob for sharing
            fetch(photo.src)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], 'pawshot.jpg', { type: 'image/jpeg' });
                    
                    navigator.share({
                        title: 'My PawShot',
                        text: 'Check out this photo I took with PawShot!',
                        files: [file]
                    })
                    .then(() => showNotification('Photo shared successfully'))
                    .catch(error => {
                        console.error('Error sharing:', error);
                        showNotification('Could not share photo');
                    });
                });
        } else {
            // Fallback for browsers that don't support Web Share API
            showNotification('Sharing not supported in this browser');
        }
    });
    
    // Edit photo - simply apply filters for this demo
    const editFilters = document.querySelectorAll('.edit-filter');
    
    editFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            const filterName = filter.dataset.filter;
            const editImage = document.getElementById('edit-image');
            
            // Update active class
            editFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            
            // Apply filter
            editImage.style.filter = getFilterStyle(filterName);
            
            // Show feedback
            showNotification(`Applied ${filterName} filter`);
        });
    });
    
    // Save edited photo
    document.getElementById('save-edit').addEventListener('click', () => {
        const photoId = parseInt(editScreen.dataset.photoId);
        const editImage = document.getElementById('edit-image');
        const activeFilter = document.querySelector('.edit-filter.active').dataset.filter;
        
        // Create canvas to save edited image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Match dimensions to image
        canvas.width = editImage.naturalWidth;
        canvas.height = editImage.naturalHeight;
        
        // Draw with filter applied
        ctx.filter = getFilterStyle(activeFilter);
        ctx.drawImage(editImage, 0, 0);
        
        // Convert to data URL
        const editedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        
        // Update in saved photos
        const photoIndex = savedPhotos.findIndex(p => p.id === photoId);
        if (photoIndex !== -1) {
            savedPhotos[photoIndex].src = editedDataUrl;
            savedPhotos[photoIndex].filter = activeFilter;
            
            // Save to local storage
            localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            
            // Update the displayed image
            editImage.src = editedDataUrl;
            
            // Show feedback
            showNotification('Edit saved');
        }
    });
    
    // Device storage and performance monitoring
    function checkDeviceStorage() {
        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(estimate => {
                const usage = estimate.usage;
                const quota = estimate.quota;
                const percentUsed = Math.round((usage / quota) * 100);
                
                // Warn if storage is low
                if (percentUsed > 80) {
                    showNotification('Device storage is low. Consider freeing up space.', 5000);
                }
                
                // Log for debugging
                console.log(`Storage: using ${Math.round(usage / (1024 * 1024))}MB out of ${Math.round(quota / (1024 * 1024))}MB (${percentUsed}%)`);
            });
        }
    }
    
    // Check storage on startup
    checkDeviceStorage();
    
    // Monitor memory performance
    if (window.performance && window.performance.memory) {
        setInterval(() => {
            const memoryInfo = window.performance.memory;
            const usedJSHeapSize = memoryInfo.usedJSHeapSize;
            const jsHeapSizeLimit = memoryInfo.jsHeapSizeLimit;
            
            const percentUsed = Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100);
            
            // If memory usage is high, try to free up resources
            if (percentUsed > 70) {
                console.warn('High memory usage detected, cleaning up resources');
                
                // Clear unused canvases and large objects
                if (window.gc) {
                    window.gc();
                }
            }
        }, 30000); // Check every 30 seconds
    }
    
    // Initialize the app with first mode selected
    document.querySelector('.mode-option[data-mode="photo"]').click();
    
    // Unload cleanly when page is closed
    window.addEventListener('unload', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    });
});
