// Global error handler to catch unexpected errors
window.onerror = function(message, source, lineno, colno, error) {
    console.error(`Error: ${message}\nLine: ${lineno}:${colno}`);
    showNotificationGlobal('App error occurred. Try reloading.');
    return true;
};

// Global notification function for use in error handler
function showNotificationGlobal(message, duration = 2000) {
    const toast = document.querySelector('.notification-toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('visible');
        
        setTimeout(() => {
            toast.classList.remove('visible');
        }, duration);
    } else {
        alert(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const appContainer = document.querySelector('.app-container');
    const viewfinder = document.getElementById('viewfinder');
    const photoPreview = document.getElementById('photo-preview');
    const shutterButton = document.getElementById('shutter-button');
    const switchCameraButton = document.getElementById('switch-camera');
    const galleryButton = document.getElementById('gallery-button');
    const backToCameraButton = document.getElementById('back-to-camera');
    const modeOptions = document.querySelectorAll('.mode-option');
    const cameraScreen = document.querySelector('.camera-screen');
    const galleryScreen = document.querySelector('.gallery-screen');
    const editScreen = document.querySelector('.edit-screen');
    const filterEffects = document.querySelectorAll('.filter-effect');
    const flashToggleButton = document.getElementById('flash-toggle');
    const hdrToggleButton = document.getElementById('hdr-toggle');
    const togglePawModeButton = document.getElementById('toggle-paw-mode');
    
    // State variables
    let stream = null;
    let facingMode = 'environment';
    let currentMode = 'photo';
    let currentFilter = 'normal';
    let flashMode = 'off';
    let isHDRActive = false;
    let isPawMode = false;
    let isTakingPhoto = false;
    let lastCaptureTime = 0;
    let stackCount = 0;
    const MAX_PHOTOS = 50; // Limit stored photos to prevent memory issues
    
    // Load saved photos from localStorage with error handling
    let savedPhotos = [];
    try {
        const savedPhotosJson = localStorage.getItem('pawShotPhotos') || '[]';
        savedPhotos = JSON.parse(savedPhotosJson);
        if (!Array.isArray(savedPhotos)) {
            throw new Error('Saved photos data is corrupt');
        }
    } catch (error) {
        console.error('Error loading saved photos:', error);
        // Reset saved photos if data is corrupt
        savedPhotos = [];
        localStorage.setItem('pawShotPhotos', '[]');
        showNotification('Photo data was reset due to an error');
    }
    
    // Initialize camera
    async function initCamera() {
        try {
            // Check camera permission status if API is available
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' });
                if (permissionStatus.state === 'denied') {
                    showNotification('Camera permission denied. Please allow camera access.');
                    return;
                }
            } catch (e) {
                console.log('Permission API not supported, continuing anyway');
            }
            
            // Stop any existing stream
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            
            // Update UI before camera starts
            viewfinder.style.backgroundColor = '#111';
            
            // Get user media with preferred camera
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 }, // Reduced from 1920 for better performance
                    height: { ideal: 720 } // Reduced from 1080 for better performance
                }
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Connect stream to video element
            viewfinder.srcObject = stream;
            viewfinder.classList.remove('hidden');
            photoPreview.classList.add('hidden');
            
            // Wait for video to be ready with timeout
            const videoReady = await Promise.race([
                new Promise(resolve => {
                    viewfinder.onloadedmetadata = () => {
                        viewfinder.play().then(resolve).catch(resolve); // Continue even if play fails
                    };
                }),
                new Promise(resolve => setTimeout(resolve, 3000)) // Timeout after 3 seconds
            ]);
            
            // Apply current filter
            viewfinder.style.filter = getFilterStyle(currentFilter);
            
            // Show notification
            if (facingMode === 'environment') {
                showNotification('Rear camera activated');
            } else {
                showNotification('Front camera activated');
            }
            
            // Update gallery button preview if photos exist
            updateGalleryButtonPreview();
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            showNotification('Could not access camera. ' + (error.message || ''));
            viewfinder.style.backgroundColor = '#333';
        }
    }
    
    // Update gallery button preview with first photo if available
    function updateGalleryButtonPreview() {
        if (savedPhotos.length > 0) {
            try {
                const galleryPreview = document.querySelector('.gallery-preview');
                galleryPreview.style.backgroundImage = `url(${savedPhotos[0].src})`;
                galleryPreview.style.backgroundSize = 'cover';
            } catch (error) {
                console.error('Error updating gallery preview:', error);
            }
        }
    }
    
    // Show notification
    function showNotification(message, duration = 2000) {
        const toast = document.querySelector('.notification-toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.classList.add('visible');
        
        // Clear any existing timeout
        if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
        }
        
        // Set new timeout
        toast.timeoutId = setTimeout(() => {
            toast.classList.remove('visible');
        }, duration);
    }
    
    // Take photo based on current mode
    async function takePhoto() {
        // Prevent rapid multiple captures
        const now = Date.now();
        if (isTakingPhoto || (now - lastCaptureTime < 1000)) {
            return;
        }
        
        lastCaptureTime = now;
        isTakingPhoto = true;
        
        // Animate shutter button
        const shutterInner = shutterButton.querySelector('.shutter-button-inner');
        shutterInner.style.transform = 'scale(0.8)';
        setTimeout(() => {
            shutterInner.style.transform = 'scale(1)';
        }, 200);
        
        try {
            // Handle different modes
            if (currentMode === 'stack') {
                // For stack mode, capture a series of photos
                await captureStackedPhotos();
            } else {
                // For photo and portrait modes
                await captureStandardPhoto();
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            showNotification('Error taking photo: ' + (error.message || ''));
        } finally {
            isTakingPhoto = false;
        }
    }
    
    // Capture a single photo
    async function captureStandardPhoto() {
        // Check if camera is available
        if (!stream || !stream.active) {
            showNotification('Camera not ready. Please wait.');
            return;
        }
        
        try {
            // Create canvas to capture frame
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Use actual video dimensions
            canvas.width = viewfinder.videoWidth;
            canvas.height = viewfinder.videoHeight;
            
            if (canvas.width === 0 || canvas.height === 0) {
                throw new Error('Cannot capture from camera (zero dimensions)');
            }
            
            // Draw current frame
            ctx.drawImage(viewfinder, 0, 0);
            
            // Apply current filter
            if (currentFilter !== 'normal') {
                try {
                    // Apply filter effect to canvas
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    tempCtx.drawImage(canvas, 0, 0);
                    
                    // Reset main canvas and apply filtered image
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.filter = getFilterStyle(currentFilter);
                    ctx.drawImage(tempCanvas, 0, 0);
                    ctx.filter = 'none';
                } catch (e) {
                    console.warn('Filter application error:', e);
                    // Continue without filter if there's an error
                }
            }
            
            // Convert to data URL with reduced quality for better performance
            const photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            
            // Save to gallery
            const newPhoto = {
                id: Date.now(),
                src: photoDataUrl,
                date: new Date().toISOString(),
                filter: currentFilter,
                pawMode: isPawMode,
                mode: currentMode
            };
            
            // Add new photo at the beginning
            savedPhotos.unshift(newPhoto);
            
            // Limit the number of stored photos to prevent memory issues
            if (savedPhotos.length > MAX_PHOTOS) {
                savedPhotos = savedPhotos.slice(0, MAX_PHOTOS);
            }
            
            // Save to localStorage
            try {
                localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            } catch (e) {
                console.error('Error saving to localStorage:', e);
                
                // If localStorage is full, remove oldest photos and try again
                if (e.name === 'QuotaExceededError') {
                    // Keep only 10 most recent photos
                    savedPhotos = savedPhotos.slice(0, 10);
                    localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
                    showNotification('Storage full - keeping only recent photos');
                }
            }
            
            // Update gallery preview
            updateGalleryButtonPreview();
            
            // Show notification
            showNotification('Photo saved to gallery');
            
            // Preview the photo briefly
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
            }, 1500);
            
        } catch (error) {
            console.error('Error in captureStandardPhoto:', error);
            showNotification('Failed to capture photo');
            throw error;
        }
    }
    
    // Capture stacked photos (multiple exposures blended together)
    async function captureStackedPhotos() {
        const numPhotos = 15; // Capture 3 photos for stacking
        stackCount = 0;
        
        try {
            showNotification(`Starting stack capture (${numPhotos} photos)`);
            
            // Create a base canvas for the final result
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = viewfinder.videoWidth;
            finalCanvas.height = viewfinder.videoHeight;
            const finalCtx = finalCanvas.getContext('2d');
            
            // Take multiple photos with small delay between them
            for (let i = 0; i < numPhotos; i++) {
                stackCount++;
                showNotification(`Capturing ${stackCount}/${numPhotos}`);
                
                // Create a temporary canvas for each photo
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = viewfinder.videoWidth;
                tempCanvas.height = viewfinder.videoHeight;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Draw current frame
                tempCtx.drawImage(viewfinder, 0, 0);
                
                // For the first photo, just copy to final canvas
                if (i === 0) {
                    finalCtx.drawImage(tempCanvas, 0, 0);
                } else {
                    // For subsequent photos, blend with the existing result
                    // using globalAlpha for transparency
                    finalCtx.globalAlpha = 0.5;
                    finalCtx.drawImage(tempCanvas, 0, 0);
                    finalCtx.globalAlpha = 1.0;
                }
                
                // Wait a moment before taking the next photo
                if (i < numPhotos - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            // Apply the current filter to the final result
            if (currentFilter !== 'normal') {
                try {
                    const filteredCanvas = document.createElement('canvas');
                    filteredCanvas.width = finalCanvas.width;
                    filteredCanvas.height = finalCanvas.height;
                    const filteredCtx = filteredCanvas.getContext('2d');
                    
                    filteredCtx.drawImage(finalCanvas, 0, 0);
                    
                    // Reset main canvas and apply filtered image
                    finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
                    finalCtx.filter = getFilterStyle(currentFilter);
                    finalCtx.drawImage(filteredCanvas, 0, 0);
                    finalCtx.filter = 'none';
                } catch (e) {
                    console.warn('Filter application error in stack:', e);
                }
            }
            
            // Convert to data URL
            const photoDataUrl = finalCanvas.toDataURL('image/jpeg', 0.85);
            
            // Save to gallery with stack indicator
            const newPhoto = {
                id: Date.now(),
                src: photoDataUrl,
                date: new Date().toISOString(),
                filter: currentFilter,
                pawMode: isPawMode,
                mode: 'stack',
                isStack: true,
                stackCount: numPhotos
            };
            
            savedPhotos.unshift(newPhoto);
            
            // Limit the number of stored photos to prevent memory issues
            if (savedPhotos.length > MAX_PHOTOS) {
                savedPhotos = savedPhotos.slice(0, MAX_PHOTOS);
            }
            
            // Save to localStorage
            try {
                localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            } catch (e) {
                console.error('Error saving stacked photo to localStorage:', e);
                
                if (e.name === 'QuotaExceededError') {
                                        // Keep only 10 most recent photos
                                        savedPhotos = savedPhotos.slice(0, 10);
                                        localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
                                        showNotification('Storage full - keeping only recent photos');
                                    }
                                }
                                
                                // Update gallery preview
                                updateGalleryButtonPreview();
                                
                                // Show notification
                                showNotification('Stack photo saved to gallery');
                                
                                // Preview the photo
                                photoPreview.width = finalCanvas.width;
                                photoPreview.height = finalCanvas.height;
                                const previewCtx = photoPreview.getContext('2d');
                                previewCtx.drawImage(finalCanvas, 0, 0);
                                
                                viewfinder.classList.add('hidden');
                                photoPreview.classList.remove('hidden');
                                
                                // Return to viewfinder after preview
                                setTimeout(() => {
                                    viewfinder.classList.remove('hidden');
                                    photoPreview.classList.add('hidden');
                                }, 1500);
                                
                            } catch (error) {
                                console.error('Error in captureStackedPhotos:', error);
                                showNotification('Failed to create stack photo');
                                throw error;
                            } finally {
                                stackCount = 0;
                            }
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
                            
                            // Show empty state if no photos
                            if (savedPhotos.length === 0) {
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
                                try {
                                    const photoItem = document.createElement('div');
                                    photoItem.className = 'photo-item';
                                    
                                    // Add special indicator for stacked photos
                                    if (photo.isStack) {
                                        const stackBadge = document.createElement('div');
                                        stackBadge.className = 'stack-badge';
                                        stackBadge.innerHTML = '<span class="material-icons-round">layers</span>';
                                        photoItem.appendChild(stackBadge);
                                    }
                                    
                                    const img = document.createElement('img');
                                    img.src = photo.src;
                                    img.alt = 'Gallery photo';
                                    img.loading = 'lazy'; // Lazy loading for better performance
                                    
                                    photoItem.appendChild(img);
                                    
                                    // Open photo in edit view when clicked
                                    photoItem.addEventListener('click', () => {
                                        openPhotoInEditView(photo);
                                    });
                                    
                                    galleryGrid.appendChild(photoItem);
                                } catch (error) {
                                    console.error('Error rendering photo:', error);
                                }
                            });
                        }
                        
                        // Open photo in edit view
                        function openPhotoInEditView(photo) {
                            try {
                                const editImage = document.getElementById('edit-image');
                                editImage.src = photo.src;
                                
                                // Show edit screen
                                cameraScreen.classList.add('hidden');
                                galleryScreen.classList.add('hidden');
                                editScreen.classList.remove('hidden');
                                
                                // Store reference to current photo
                                editScreen.dataset.photoId = photo.id;
                                
                                // Add photo info if available
                                const editInfo = document.querySelector('.edit-info');
                                if (editInfo) {
                                    const date = new Date(photo.date).toLocaleString();
                                    const mode = photo.mode.charAt(0).toUpperCase() + photo.mode.slice(1);
                                    const filter = photo.filter.charAt(0).toUpperCase() + photo.filter.slice(1);
                                    
                                    let infoHTML = `
                                        <div>Date: ${date}</div>
                                        <div>Mode: ${mode}</div>
                                        <div>Filter: ${filter}</div>
                                    `;
                                    
                                    if (photo.isStack) {
                                        infoHTML += `<div>Stack Photos: ${photo.stackCount || 'Multiple'}</div>`;
                                    }
                                    
                                    editInfo.innerHTML = infoHTML;
                                }
                            } catch (error) {
                                console.error('Error opening photo in edit view:', error);
                                showNotification('Error displaying photo');
                            }
                        }
                        
                        // Download the current photo
                        function downloadPhoto() {
                            try {
                                const photoId = parseInt(editScreen.dataset.photoId);
                                const photo = savedPhotos.find(p => p.id === photoId);
                                
                                if (!photo) {
                                    showNotification('Photo not found');
                                    return;
                                }
                                
                                // Create a temporary anchor element for download
                                const link = document.createElement('a');
                                link.href = photo.src;
                                link.download = `pawshot_${photoId}.jpg`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                showNotification('Photo download started');
                            } catch (error) {
                                console.error('Error downloading photo:', error);
                                showNotification('Could not download photo');
                            }
                        }
                        
                        // Delete the current photo
                        function deletePhoto() {
                            try {
                                const photoId = parseInt(editScreen.dataset.photoId);
                                
                                // Remove photo from saved photos
                                savedPhotos = savedPhotos.filter(photo => photo.id !== photoId);
                                
                                // Save updated array to localStorage
                                localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
                                
                                // Update gallery preview
                                updateGalleryButtonPreview();
                                
                                // Show notification
                                showNotification('Photo deleted');
                                
                                // Return to gallery
                                editScreen.classList.add('hidden');
                                galleryScreen.classList.remove('hidden');
                                renderGallery();
                            } catch (error) {
                                console.error('Error deleting photo:', error);
                                showNotification('Could not delete photo');
                            }
                        }
                        
                        // Initialize the camera when page loads
                        initCamera().catch(error => {
                            console.error('Camera initialization error:', error);
                            showNotification('Could not initialize camera');
                        });
                        
                        // Event listeners with error handling
                        
                        // Shutter button
                        shutterButton.addEventListener('click', () => {
                            try {
                                takePhoto();
                            } catch (error) {
                                console.error('Error in shutter button handler:', error);
                                showNotification('Error taking photo');
                            }
                        });
                        
                        // Switch camera button
                        switchCameraButton.addEventListener('click', () => {
                            try {
                                facingMode = facingMode === 'environment' ? 'user' : 'environment';
                                initCamera();
                            } catch (error) {
                                console.error('Error switching camera:', error);
                                showNotification('Error switching camera');
                            }
                        });
                        
                        // Gallery button
                        galleryButton.addEventListener('click', () => {
                            try {
                                cameraScreen.classList.add('hidden');
                                galleryScreen.classList.remove('hidden');
                                renderGallery();
                            } catch (error) {
                                console.error('Error opening gallery:', error);
                                showNotification('Error opening gallery');
                            }
                        });
                        
                        // Back to camera button
                        backToCameraButton.addEventListener('click', () => {
                            try {
                                galleryScreen.classList.add('hidden');
                                cameraScreen.classList.remove('hidden');
                            } catch (error) {
                                console.error('Error returning to camera:', error);
                                showNotification('Error returning to camera');
                            }
                        });
                        
                        // Back to gallery button
                        document.getElementById('back-to-gallery').addEventListener('click', () => {
                            try {
                                editScreen.classList.add('hidden');
                                galleryScreen.classList.remove('hidden');
                            } catch (error) {
                                console.error('Error returning to gallery:', error);
                                showNotification('Error returning to gallery');
                            }
                        });
                        
                        // Delete photo button
                        document.getElementById('delete-photo').addEventListener('click', () => {
                            try {
                                deletePhoto();
                            } catch (error) {
                                console.error('Error in delete photo handler:', error);
                                showNotification('Error deleting photo');
                            }
                        });
                        
                        // Download button (if present)
                        const downloadButton = document.getElementById('download-photo');
                        if (downloadButton) {
                            downloadButton.addEventListener('click', () => {
                                try {
                                    downloadPhoto();
                                } catch (error) {
                                    console.error('Error in download photo handler:', error);
                                    showNotification('Error downloading photo');
                                }
                            });
                        }
                        
                        // Toggle paw mode
                        togglePawModeButton.addEventListener('click', () => {
                            try {
                                isPawMode = !isPawMode;
                                appContainer.classList.toggle('paw-mode', isPawMode);
                                
                                if (isPawMode) {
                                    showNotification('Paw Mode activated!');
                                } else {
                                    showNotification('Paw Mode deactivated');
                                }
                            } catch (error) {
                                console.error('Error toggling paw mode:', error);
                                showNotification('Error toggling paw mode');
                            }
                        });
                        
                        // Mode selector (photo, portrait, stack)
                        modeOptions.forEach(option => {
                            option.addEventListener('click', () => {
                                try {
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
                                    
                                    // Show feedback
                                    showNotification(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode activated`);
                                } catch (error) {
                                    console.error('Error changing mode:', error);
                                    showNotification('Error changing mode');
                                }
                            });
                        });
                        
                        // Flash toggle
                        flashToggleButton.addEventListener('click', () => {
                            try {
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
                            } catch (error) {
                                console.error('Error toggling flash:', error);
                                showNotification('Error toggling flash');
                            }
                        });
                        
                        // HDR toggle
                        hdrToggleButton.addEventListener('click', () => {
                            try {
                                isHDRActive = !isHDRActive;
                                
                                // Update UI
                                hdrToggleButton.classList.toggle('active', isHDRActive);
                                
                                showNotification(`HDR: ${isHDRActive ? 'On' : 'Off'}`);
                            } catch (error) {
                                console.error('Error toggling HDR:', error);
                                showNotification('Error toggling HDR');
                            }
                        });
                        
                        // Filter effects
                        filterEffects.forEach(effect => {
                            effect.addEventListener('click', () => {
                                try {
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
                                } catch (error) {
                                    console.error('Error changing filter:', error);
                                    showNotification('Error changing filter');
                                }
                            });
                        });
                        
                        // Initialize the app with first mode selected
                        document.querySelector('.mode-option[data-mode="photo"]').click();
                        
                        // Unload cleanly when page is closed
                        window.addEventListener('unload', () => {
                            try {
                                if (stream) {
                                    stream.getTracks().forEach(track => track.stop());
                                }
                            } catch (error) {
                                console.error('Error during cleanup:', error);
                            }
                        });
                        
                        // Add visibility change handler to restart camera when app is foregrounded
                        document.addEventListener('visibilitychange', () => {
                            if (document.visibilityState === 'visible') {
                                // App is now visible, reinitialize camera if we're on the camera screen
                                if (!cameraScreen.classList.contains('hidden')) {
                                    initCamera().catch(error => {
                                        console.error('Camera restart error:', error);
                                    });
                                }
                            } else {
                                // App is now hidden, optionally stop the stream to save resources
                                if (stream) {
                                    stream.getTracks().forEach(track => track.stop());
                                    stream = null;
                                }
                            }
                        });
                        
                        // Restart on orientation change to fix camera orientation issues
                        window.addEventListener('orientationchange', () => {
                            // Wait for UI to update before restarting camera
                            setTimeout(() => {
                                if (!cameraScreen.classList.contains('hidden')) {
                                    initCamera().catch(error => {
                                        console.error('Camera restart after orientation change error:', error);
                                    });
                                }
                            }, 300);
                        });
                        
                            // Handle clicks outside of UI elements to prevent accidental taps
    document.addEventListener('click', (event) => {
        // If clicked element is not a control, do nothing
        if (!event.target.closest('.control-button') && 
            !event.target.closest('#shutter-button') &&
            !event.target.closest('.mode-option') &&
            !event.target.closest('.filter-effect') &&
            !event.target.closest('.photo-item') &&
            !event.target.closest('.header-button') &&
            !event.target.closest('.edit-action-button')) {
            
            // Prevent default action for non-UI elements to avoid accidental interactions
            event.preventDefault();
        }
    });
    
    // Add touch specific handlers for better mobile experience
    document.addEventListener('touchstart', (event) => {
        // Prevent pinch-zoom on the camera app
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    }, { passive: false });
    
    // Clear any stuck touches on touchend
    document.addEventListener('touchend', () => {
        // For stability, ensure touch state is reset
        isTakingPhoto = false;
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Only process if on camera screen
        if (cameraScreen.classList.contains('hidden')) return;
        
        try {
            switch (event.key) {
                case ' ':  // Space to take photo
                    takePhoto();
                    break;
                    
                case 'f':  // F to toggle flash
                    flashToggleButton.click();
                    break;
                    
                case 's':  // S to switch camera
                    switchCameraButton.click();
                    break;
                    
                case 'g':  // G to open gallery
                    galleryButton.click();
                    break;
                    
                case 'p':  // P to toggle paw mode
                    togglePawModeButton.click();
                    break;
            }
        } catch (error) {
            console.error('Error handling keyboard shortcut:', error);
        }
    });
    
    // Add recovery mechanism for camera failures
    let cameraFailureCount = 0;
    const MAX_CAMERA_FAILURES = 3;
    
    function recoverFromCameraFailure() {
        cameraFailureCount++;
        
        if (cameraFailureCount <= MAX_CAMERA_FAILURES) {
            showNotification(`Attempting to restart camera (${cameraFailureCount}/${MAX_CAMERA_FAILURES})`);
            
            // Short delay before retry
            setTimeout(() => {
                initCamera().catch(error => {
                    console.error('Camera recovery attempt failed:', error);
                    
                    if (cameraFailureCount >= MAX_CAMERA_FAILURES) {
                        showNotification('Camera recovery failed. Please reload the app.', 5000);
                    } else {
                        recoverFromCameraFailure();
                    }
                });
            }, 1000);
        }
    }
    
    // Monitor video element for failures
    viewfinder.addEventListener('error', () => {
        console.error('Video element error');
        recoverFromCameraFailure();
    });
    
    // Function to check if localStorage is available
    function isLocalStorageAvailable() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    // If localStorage isn't available, show a notification
    if (!isLocalStorageAvailable()) {
        showNotification('Warning: Storage not available. Photos won\'t be saved.', 5000);
    }
    
    // Add application error boundary
    window.addEventListener('error', (event) => {
        console.error('Unhandled error:', event.error);
        showNotification('Application error occurred', 3000);
        
        // Prevent the default behavior which might crash the app
        event.preventDefault();
        
        // Try to recover if on camera screen
        if (!cameraScreen.classList.contains('hidden')) {
            // Give the app a moment before trying to recover
            setTimeout(() => {
                recoverFromCameraFailure();
            }, 2000);
        }
        
        return true; // Prevent default error handling
    });

    // Add periodic memory cleanup for long sessions
    setInterval(() => {
        // Run garbage collection if available (not standard, but can help in some browsers)
        if (typeof window.gc === 'function') {
            try {
                window.gc();
            } catch (e) {
                // Ignore if not supported
            }
        }
        
        // Check if camera is working, if not and we're on camera screen, try to recover
        if (!cameraScreen.classList.contains('hidden') && 
            (!stream || !stream.active || stream.getTracks().some(track => !track.enabled || track.readyState !== 'live'))) {
            
            console.warn('Camera stream appears to be inactive, attempting recovery');
            recoverFromCameraFailure();
        }
    }, 30000); // Run every 30 seconds
});
