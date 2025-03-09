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
    const photoGallery = document.getElementById('photo-gallery');
    
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
    let savedPhotos = JSON.parse(localStorage.getItem('pawShotPhotos')) || [];

    // Initialize camera
    async function initCamera() {
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            viewfinder.srcObject = stream;
            
            // Enable exposure control if supported
            const videoTrack = stream.getVideoTracks()[0];
            const capabilities = videoTrack.getCapabilities();
            
            if (capabilities.exposureMode && capabilities.exposureCompensation) {
                exposureControl.parentElement.classList.add('active');
                exposureControl.addEventListener('input', function() {
                    const settings = videoTrack.getSettings();
                    videoTrack.applyConstraints({
                        advanced: [{
                            exposureMode: 'manual',
                            exposureCompensation: parseFloat(exposureControl.value)
                        }]
                    });
                });
            }
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            alert('Unable to access camera. Please check your permissions.');
        }
    }

    // Take photo function
    function takePhoto() {
        if (isTakingPhoto) return;
        
        isTakingPhoto = true;
        
        // Create animation effect
        const flash = document.createElement('div');
        flash.style.position = 'absolute';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = 'white';
        flash.style.opacity = '0';
        flash.style.transition = 'opacity 0.1s';
        flash.style.zIndex = '5';
        viewfinder.parentElement.appendChild(flash);
        
        // Flash effect
        setTimeout(() => {
            flash.style.opacity = '1';
            setTimeout(() => {
                flash.style.opacity = '0';
                setTimeout(() => {
                    flash.remove();
                }, 100);
            }, 100);
        }, 0);
        
        if (currentMode === 'stack') {
            takeStackedPhoto();
            return;
        }
        
        // Capture photo
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewfinder.videoWidth;
        canvas.height = viewfinder.videoHeight;
        
        // Apply current filter
        ctx.filter = getFilterStyle(currentFilter);
        
        // Draw the video frame to the canvas
        ctx.drawImage(viewfinder, 0, 0, canvas.width, canvas.height);
        
        // Apply paw mode effects if active
        if (isPawMode) {
            applyPawEffect(ctx, canvas.width, canvas.height);
        }
        
        // Convert to data URL and save
        const photoData = canvas.toDataURL('image/jpeg');
        savedPhotos.unshift({
            id: Date.now(),
            src: photoData,
            date: new Date().toISOString(),
            filter: currentFilter,
            pawMode: isPawMode,
            mode: currentMode
        });
        
        // Save to local storage
        localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
        
        // Show preview briefly
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
        }, 1000);
        
        // Update gallery
        renderGallery();
    }
    
    // Take multiple photos and stack them for improved quality
    function takeStackedPhoto() {
        const stackCount = 5;
        const stackProgress = document.createElement('div');
        stackProgress.className = 'stack-progress active';
        stackProgress.innerHTML = `
            <div class="stack-indicator"></div>
            <div class="stack-status">Capturing 1/${stackCount}</div>
        `;
        viewfinder.parentElement.appendChild(stackProgress);
        
        const frames = [];
        let currentFrame = 0;
        
        function captureFrame() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewfinder.videoWidth;
            canvas.height = viewfinder.videoHeight;
            ctx.drawImage(viewfinder, 0, 0, canvas.width, canvas.height);
            frames.push(canvas);
            
            currentFrame++;
            
            if (currentFrame < stackCount) {
                stackProgress.querySelector('.stack-status').textContent = `Capturing ${currentFrame+1}/${stackCount}`;
                setTimeout(captureFrame, 200);
            } else {
                stackProgress.querySelector('.stack-status').textContent = 'Processing...';
                setTimeout(processStackedFrames, 500);
            }
        }
        
        function processStackedFrames() {
            const resultCanvas = document.createElement('canvas');
            const resultCtx = resultCanvas.getContext('2d');
            resultCanvas.width = frames[0].width;
            resultCanvas.height = frames[0].height;
            
            // Simple averaging for stacking (a more advanced algorithm would be better)
            resultCtx.drawImage(frames[0], 0, 0);
            const baseImageData = resultCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
            const baseData = baseImageData.data;
            
            for (let i = 1; i < frames.length; i++) {
                const frameCtx = frames[i].getContext('2d');
                const frameData = frameCtx.getImageData(0, 0, frames[i].width, frames[i].height).data;
                
                for (let j = 0; j < baseData.length; j += 4) {
                    // Average the RGB values
                    baseData[j] = (baseData[j] * i + frameData[j]) / (i + 1);
                    baseData[j + 1] = (baseData[j + 1] * i + frameData[j + 1]) / (i + 1);
                    baseData[j + 2] = (baseData[j + 2] * i + frameData[j + 2]) / (i + 1);
                }
            }
            
            resultCtx.putImageData(baseImageData, 0, 0);
            
            // Apply filter
            const finalCanvas = document.createElement('canvas');
            const finalCtx = finalCanvas.getContext('2d');
            finalCanvas.width = resultCanvas.width;
            finalCanvas.height = resultCanvas.height;
            finalCtx.filter = getFilterStyle(currentFilter);
            finalCtx.drawImage(resultCanvas, 0, 0);
            
            // Apply paw effect if in paw mode
            if (isPawMode) {
                applyPawEffect(finalCtx, finalCanvas.width, finalCanvas.height);
            }
            
            // Save the resulting image
            const photoData = finalCanvas.toDataURL('image/jpeg');
            savedPhotos.unshift({
                id: Date.now(),
                src: photoData,
                date: new Date().toISOString(),
                filter: currentFilter,
                pawMode: isPawMode,
                mode: 'stack'
            });
            
            localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            
                        // Display preview
                        photoPreview.width = finalCanvas.width;
                        photoPreview.height = finalCanvas.height;
                        const previewCtx = photoPreview.getContext('2d');
                        previewCtx.drawImage(finalCanvas, 0, 0);
                        
                        viewfinder.classList.add('hidden');
                        photoPreview.classList.remove('hidden');
                        
                        // Remove progress indicator
                        stackProgress.remove();
                        
                        // Return to viewfinder after preview
                        setTimeout(() => {
                            viewfinder.classList.remove('hidden');
                            photoPreview.classList.add('hidden');
                            isTakingPhoto = false;
                        }, 1500);
                        
                        // Update gallery
                        renderGallery();
                    }
                    
                    // Start capturing frames
                    captureFrame();
                }
                
                // Apply paw effect to canvas
                function applyPawEffect(ctx, width, height) {
                    // Add paw prints randomly
                    const pawCount = Math.floor(Math.random() * 3) + 2;
                    
                    for (let i = 0; i < pawCount; i++) {
                        const x = Math.random() * width;
                        const y = Math.random() * height;
                        const scale = 0.2 + (Math.random() * 0.3);
                        const rotation = Math.random() * 360;
                        
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(rotation * Math.PI / 180);
                        ctx.scale(scale, scale);
                        
                        // Draw a paw shape
                        ctx.fillStyle = 'rgba(255, 105, 180, 0.4)';
                        ctx.beginPath();
                        ctx.ellipse(0, 10, 15, 20, 0, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        // Draw toe beans
                        ctx.fillStyle = 'rgba(255, 182, 193, 0.6)';
                        ctx.beginPath();
                        ctx.ellipse(-15, -15, 10, 10, 0, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.ellipse(15, -15, 10, 10, 0, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.ellipse(-25, 0, 10, 10, 0, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.ellipse(25, 0, 10, 10, 0, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        ctx.restore();
                    }
                    
                    // Add slight vignette and warm tint for paw mode
                    const gradient = ctx.createRadialGradient(
                        width / 2, height / 2, 0,
                        width / 2, height / 2, Math.max(width, height) / 1.5
                    );
                    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0)');
                    gradient.addColorStop(1, 'rgba(255, 182, 193, 0.3)');
                    
                    ctx.fillStyle = gradient;
                    ctx.globalCompositeOperation = 'overlay';
                    ctx.fillRect(0, 0, width, height);
                    ctx.globalCompositeOperation = 'source-over';
                }
                
                // Get CSS filter style based on selected filter
                function getFilterStyle(filter) {
                    switch (filter) {
                        case 'vintage':
                            return 'sepia(0.5) contrast(1.2) brightness(0.9)';
                        case 'noir':
                            return 'grayscale(1) contrast(1.3) brightness(0.8)';
                        case 'pawify':
                            return 'saturate(1.3) hue-rotate(330deg) brightness(1.05)';
                        case 'normal':
                        default:
                            return 'none';
                    }
                }
                
                // Render photos in gallery
                function renderGallery() {
                    photoGallery.innerHTML = '';
                    
                    if (savedPhotos.length === 0) {
                        photoGallery.innerHTML = '<div class="empty-gallery">No photos yet!</div>';
                        return;
                    }
                    
                    savedPhotos.forEach(photo => {
                        const photoItem = document.createElement('div');
                        photoItem.className = 'photo-item';
                        photoItem.innerHTML = `<img src="${photo.src}" alt="Photo ${photo.id}">`;
                        
                        // Add badge for special photos
                        if (photo.mode === 'stack' || photo.pawMode) {
                            const badge = document.createElement('div');
                            badge.className = 'photo-badge';
                            badge.textContent = photo.mode === 'stack' ? 'Stack' : '🐾';
                            badge.style.position = 'absolute';
                            badge.style.top = '5px';
                            badge.style.right = '5px';
                            badge.style.backgroundColor = photo.mode === 'stack' ? 'rgba(88, 86, 214, 0.7)' : 'rgba(255, 105, 180, 0.7)';
                            badge.style.color = 'white';
                            badge.style.fontSize = '10px';
                            badge.style.padding = '2px 5px';
                            badge.style.borderRadius = '8px';
                            photoItem.appendChild(badge);
                        }
                        
                        photoItem.addEventListener('click', () => {
                            openEditScreen(photo);
                        });
                        
                        photoGallery.appendChild(photoItem);
                    });
                }
                
                // Open edit screen with selected photo
                function openEditScreen(photo) {
                    const editImage = document.getElementById('edit-image');
                    editImage.src = photo.src;
                    
                    cameraScreen.classList.remove('active');
                    galleryScreen.classList.remove('active');
                    editScreen.classList.add('active');
                    
                    // Set up edit tools
                    const tools = document.querySelectorAll('.tool');
                    tools.forEach(tool => {
                        tool.addEventListener('click', function() {
                            const toolName = this.dataset.tool;
                            
                            if (toolName === 'pawify') {
                                // Create a canvas to apply pawify effect
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                
                                canvas.width = editImage.naturalWidth;
                                canvas.height = editImage.naturalHeight;
                                
                                // First draw the current image
                                ctx.drawImage(editImage, 0, 0);
                                
                                // Apply paw effect
                                applyPawEffect(ctx, canvas.width, canvas.height);
                                
                                // Update the edit image
                                editImage.src = canvas.toDataURL('image/jpeg');
                                
                                // Animate the button
                                this.style.transform = 'scale(1.1)';
                                setTimeout(() => {
                                    this.style.transform = 'scale(1)';
                                }, 200);
                            }
                        });
                    });
                }
                
                // Switch between screens
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
                
                document.getElementById('save-edit').addEventListener('click', () => {
                    const editImage = document.getElementById('edit-image');
                    
                    // Create a new photo entry from the edited image
                    savedPhotos.unshift({
                        id: Date.now(),
                        src: editImage.src,
                        date: new Date().toISOString(),
                        filter: 'custom',
                        pawMode: isPawMode,
                        mode: 'edited'
                    });
                    
                    localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
                    
                    editScreen.classList.remove('active');
                    galleryScreen.classList.add('active');
                    renderGallery();
                });
                
                // Camera controls
                shutterButton.addEventListener('click', takePhoto);
                
                switchCameraButton.addEventListener('click', () => {
                    facingMode = facingMode === 'environment' ? 'user' : 'environment';
                    initCamera();
                });
                
                togglePawModeButton.addEventListener('click', () => {
                    isPawMode = !isPawMode;
                    appContainer.classList.toggle('paw-mode', isPawMode);
                    
                    if (isPawMode) {
                        // Create animated paw prints for fun
                        for (let i = 0; i < 5; i++) {
                            setTimeout(() => {
                                const pawPrint = document.createElement('div');
                                pawPrint.className = 'paw-print';
                                pawPrint.style.left = Math.random() * 100 + '%';
                                pawPrint.style.top = Math.random() * 100 + '%';
                                viewfinder.parentElement.appendChild(pawPrint);
                                
                                // Animate in
                                setTimeout(() => {
                                    pawPrint.style.opacity = '0.8';
                                    
                                    // Animate out after a delay
                                    setTimeout(() => {
                                        pawPrint.style.opacity = '0';
                                        setTimeout(() => {
                                            pawPrint.remove();
                                        }, 300);
                                    }, 1000);
                                }, 0);
                            }, i * 200);
                        }
                    }
                });
                
                flashToggleButton.addEventListener('click', () => {
                    const flashModes = ['off', 'auto', 'on'];
                    const flashIcons = ['⚡', '⚡A', '⚡'];
                    
                    const currentIndex = flashModes.indexOf(flashMode);
                    const nextIndex = (currentIndex + 1) % flashModes.length;
                    
                    flashMode = flashModes[nextIndex];
                    flashToggleButton.textContent = flashIcons[nextIndex];
                    
                    if (flashMode === 'off') {
                        flashToggleButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    } else if (flashMode === 'auto') {
                        flashToggleButton.style.backgroundColor = 'rgba(255, 204, 0, 0.5)';
                    } else {
                        flashToggleButton.style.backgroundColor = 'rgba(255, 204, 0, 0.8)';
                    }
                });
                
                hdrToggleButton.addEventListener('click', () => {
                    isHDRActive = !isHDRActive;
                    
                    if (isHDRActive) {
                        hdrToggleButton.style.backgroundColor = 'rgba(255, 204, 0, 0.7)';
                        
                        // Add HDR indicator
                        const hdrIndicator = document.createElement('div');
                        hdrIndicator.className = 'hdr-active';
                        hdrIndicator.textContent = 'HDR';
                        hdrIndicator.id = 'hdr-indicator';
                        viewfinder.parentElement.appendChild(hdrIndicator);
                    } else {
                        hdrToggleButton.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                        const indicator = document.getElementById('hdr-indicator');
                        if (indicator) indicator.remove();
                    }
                });
                
                // Mode selection
                modeOptions.forEach(option => {
                    option.addEventListener('click', function() {
                        modeOptions.forEach(opt => opt.classList.remove('active'));
                        this.classList.add('active');
                        
                        currentMode = this.dataset.mode;
                        
                        // If stack mode selected, add indicator
                        const stackIndicator = document.getElementById('stack-indicator');
                        if (currentMode === 'stack') {
                            if (!stackIndicator) {
                                const indicator = document.createElement('div');
                                indicator.className = 'stack-active';
                                indicator.textContent = 'STACK';
                                indicator.id = 'stack-indicator';
                                viewfinder.parentElement.appendChild(indicator);
                            }
                        } else if (stackIndicator) {
                            stackIndicator.remove();
                        }
                    });
                });
                
                // Filter selection
                filterEffects.forEach(filter => {
                    filter.addEventListener('click', function() {
                        currentFilter = this.dataset.filter;
                        
                        // Apply visual feedback
                        filterEffects.forEach(f => f.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)');
                        this.style.boxShadow = '0 0 0 2px white, 0 4px 8px rgba(0,0,0,0.3)';
                        
                        // Apply live filter to viewfinder if possible
                        viewfinder.style.filter = getFilterStyle(currentFilter);
                    });
                });
                
                // Touch interaction for focus and exposure
                let touchStartTime;
                let longPressTimeout;
                
                viewfinder.parentElement.addEventListener('touchstart', (e) => {
                    touchStartTime = Date.now();
                    
                    // Check for long press to adjust exposure
                    longPressTimeout = setTimeout(() => {
                        const touchX = e.touches[0].clientX;
                        const touchY = e.touches[0].clientY;
                        
                        // Show exposure slider
                        const exposureSlider = document.querySelector('.exposure-slider');
                        exposureSlider.style.opacity = '1';
                        
                        // Prevent default to avoid triggering focus
                        e.preventDefault();
                    }, 800);
                    
                    // Show focus indicator
                    const focusIndicator = document.querySelector('.focus-indicator');
                    focusIndicator.style.left = e.touches[0].clientX + 'px';
                    focusIndicator.style.top = e.touches[0].clientY + 'px';
                    focusIndicator.style.opacity = '1';
                    
                    setTimeout(() => {
                        focusIndicator.style.transform = 'translate(-50%, -50%) scale(0.7)';
                    }, 200);
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
                    
                    // If it wasn't a long press, set focus point
                    if (touchDuration < 800) {
                        if (stream) {
                            const videoTrack = stream.getVideoTracks()[0];
                            const capabilities = videoTrack.getCapabilities();
                            
                            if (capabilities.focusMode && capabilities.focusMode.includes('manual')) {
                                try {
                                    // Convert touch position to normalized coordinates
                                    const viewfinderRect = viewfinder.getBoundingClientRect();
                                    const touchX = e.changedTouches[0].clientX;
                                    const touchY = e.changedTouches[0].clientY;
                                    
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
                });
                
                // Initialize the app
                function initApp() {
                    // Check for camera permissions
                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        alert('Your browser does not support camera access. Please try a different browser.');
                        return;
                    }
                    
                    initCamera();
                    renderGallery();
                    
                    // Initialize filter selection
                    filterEffects[0].style.boxShadow = '0 0 0 2px white, 0 4px 8px rgba(0,0,0,0.3)';
                    
                    // Check if service worker is supported
                    if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.register('service-worker.js')
                            .then(reg => console.log('Service Worker registered with scope:', reg.scope))
                            .catch(err => console.error('Service Worker registration failed:', err));
                    }
                }
                
                // Start the app
                initApp();
                
                // Cleanup function to ensure camera is released when page is closed
                window.addEventListener('beforeunload', () => {
                    if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                    }
                });
            });