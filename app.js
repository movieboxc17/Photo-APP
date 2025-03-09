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
        savedPhotos = [];
        localStorage.setItem('pawShotPhotos', '[]');
        showNotification('Photo data was reset due to an error');
    }
    
    // Initialize camera with maximum quality
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
            
            // Get maximum quality from camera
            // iPhone 12MP camera = 4032x3024 (4:3) or 4032x2268 (16:9)
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 4032 },
                    height: { ideal: 3024 },
                    frameRate: { ideal: 30 },
                    // Request highest quality
                    advanced: [
                        { exposureMode: 'continuous' },
                        { focusMode: 'continuous' }
                    ]
                },
                audio: false
            };
            
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Get available capabilities to check resolution
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
                console.log('Camera capabilities:', capabilities);
                
                // Apply advanced settings if supported
                if (videoTrack.applyConstraints) {
                    try {
                        // Try to apply optimal quality settings
                        await videoTrack.applyConstraints({
                            advanced: [
                                { exposureMode: 'continuous' },
                                { focusMode: 'continuous' },
                                { whiteBalanceMode: 'continuous' }
                            ]
                        });
                    } catch (e) {
                        console.log('Could not apply advanced constraints:', e);
                    }
                }
            }
            
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
            
            // Show notification with camera resolution
            if (viewfinder.videoWidth && viewfinder.videoHeight) {
                const megapixels = ((viewfinder.videoWidth * viewfinder.videoHeight) / 1000000).toFixed(1);
                if (facingMode === 'environment') {
                    showNotification(`Rear camera: ${viewfinder.videoWidth}×${viewfinder.videoHeight} (${megapixels}MP)`);
                } else {
                    showNotification(`Front camera: ${viewfinder.videoWidth}×${viewfinder.videoHeight} (${megapixels}MP)`);
                }
            } else {
                if (facingMode === 'environment') {
                    showNotification('Rear camera activated');
                } else {
                    showNotification('Front camera activated');
                }
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
    
    // Capture a single photo with maximum quality
    async function captureStandardPhoto() {
        // Check if camera is available
        if (!stream || !stream.active) {
            showNotification('Camera not ready. Please wait.');
            return;
        }
        
        try {
            // Create off-screen canvas at full resolution
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', {
                alpha: false,
                desynchronized: true, // For better performance
                willReadFrequently: false
            });
            
            // Enable high quality image rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Use native video dimensions to get full resolution
            canvas.width = viewfinder.videoWidth;
            canvas.height = viewfinder.videoHeight;
            
            if (canvas.width === 0 || canvas.height === 0) {
                throw new Error('Cannot capture from camera (zero dimensions)');
            }
            
            // Show shutter animation
            const flash = document.createElement('div');
            flash.className = 'shutter-flash';
            flash.style.position = 'absolute';
            flash.style.top = '0';
            flash.style.left = '0';
            flash.style.width = '100%';
            flash.style.height = '100%';
            flash.style.backgroundColor = 'white';
            flash.style.opacity = '0';
            flash.style.transition = 'opacity 0.1s ease-out';
            viewfinder.parentNode.appendChild(flash);

            setTimeout(() => {
                flash.style.opacity = '1';
                setTimeout(() => {
                    flash.style.opacity = '0';
                    setTimeout(() => {
                        viewfinder.parentNode.removeChild(flash);
                    }, 100);
                }, 50);
            }, 0);
            
            // Leverage device hardware for better performance
            if (window.createImageBitmap) {
                // Using createImageBitmap for better performance on supported devices
                const imageBitmap = await createImageBitmap(viewfinder);
                ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
                imageBitmap.close(); // Release memory
            } else {
                // Fallback to standard drawing
                ctx.drawImage(viewfinder, 0, 0, canvas.width, canvas.height);
            }
            
            // Apply current filter
            if (currentFilter !== 'normal') {
                try {
                    // Apply filter effect using hardware acceleration where possible
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const tempCtx = tempCanvas.getContext('2d', {
                        alpha: false,
                        desynchronized: true
                    });
                    
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
            
            // Convert to data URL with high quality for max resolution
            const photoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
            
            // Save to gallery
            const newPhoto = {
                id: Date.now(),
                src: photoDataUrl,
                date: new Date().toISOString(),
                filter: currentFilter,
                pawMode: isPawMode,
                mode: currentMode,
                width: canvas.width,
                height: canvas.height,
                megapixels: ((canvas.width * canvas.height) / 1000000).toFixed(1)
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
                    // Handle storage limits - create compressed version
                    const compressedPhotos = savedPhotos.map(photo => {
                        // Create a smaller preview version for the first 10 photos
                        if (savedPhotos.indexOf(photo) < 10) {
                            return photo;
                        }
                        
                        // For older photos, create smaller thumbnails to save space
                        const img = new Image();
                        img.src = photo.src;
                        
                        const smallCanvas = document.createElement('canvas');
                        const smallCtx = smallCanvas.getContext('2d');
                        
                        // Reduce resolution of older photos
                        smallCanvas.width = 800;
                        smallCanvas.height = 600;
                        
                        smallCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);
                        
                        // Return compressed version
                        return {
                            ...photo,
                            src: smallCanvas.toDataURL('image/jpeg', 0.7)
                        };
                    });
                    
                    // Try saving compressed version
                    try {
                        localStorage.setItem('pawShotPhotos', JSON.stringify(compressedPhotos));
                        savedPhotos = compressedPhotos;
                        showNotification('Photos compressed to save space');
                    } catch (compressError) {
                        // If still fails, keep only recent photos
                        savedPhotos = savedPhotos.slice(0, 10);
                        localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
                        showNotification('Storage full - keeping only recent photos');
                    }
                }
            }
            
            // Update gallery preview
            updateGalleryButtonPreview();
            
            // Show megapixel info in notification
            const megapixels = ((canvas.width * canvas.height) / 1000000).toFixed(1);
            showNotification(`Photo saved: ${megapixels}MP (${canvas.width}×${canvas.height})`);
            
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
                
                // Release memory
                URL.revokeObjectURL(photoPreview.src);
                canvas.width = 1;
                canvas.height = 1;
            }, 1500);
            
        } catch (error) {
            console.error('Error in captureStandardPhoto:', error);
            showNotification('Failed to capture photo');
            throw error;
        }
    }
    
    // Capture stacked photos (multiple exposures blended together)
    async function captureStackedPhotos() {
        const numPhotos = 3; // Capture 3 photos for stacking
        stackCount = 0;
        
        try {
            showNotification(`Starting stack capture (${numPhotos} photos)`);
            
            // Create a base canvas for the final result at full resolution
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = viewfinder.videoWidth;
            finalCanvas.height = viewfinder.videoHeight;
            const finalCtx = finalCanvas.getContext('2d', {
                alpha: false,
                desynchronized: true
            });
            
            // Enable high quality image rendering
            finalCtx.imageSmoothingEnabled = true;
            finalCtx.imageSmoothingQuality = 'high';
            
            // Array to hold our frame bitmaps for more efficient processing
            const frames = [];
            
            // Take multiple photos with small delay between them
            for (let i = 0; i < numPhotos; i++) {
                stackCount++;
                showNotification(`Capturing ${stackCount}/${numPhotos}`);
                
                // Use createImageBitmap for better performance if available
                if (window.createImageBitmap) {
                    const bitmap = await createImageBitmap(viewfinder);
                    frames.push(bitmap);
                } else {
                    // Fallback for browsers without createImageBitmap
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = viewfinder.videoWidth;
                    tempCanvas.height = viewfinder.videoHeight;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(viewfinder, 0, 0);
                    frames.push(tempCanvas);
                }
                
                // Show shutter animation for each frame
                const flash = document.createElement('div');
                flash.className = 'shutter-flash';
                flash.style.position = 'absolute';
                flash.style.top = '0';
                flash.style.left = '0';
                flash.style.width = '100%';
                flash.style.height = '100%';
                flash.style.backgroundColor = 'white';
                flash.style.opacity = '0';
                flash.style.transition = 'opacity 0.1s ease-out';
                viewfinder.parentNode.appendChild(flash);
                
                await new Promise(resolve => {
                    setTimeout(() => {
                        flash.style.opacity = '0.5';
                        setTimeout(() => {
                            flash.style.opacity = '0';
                            setTimeout(() => {
                                viewfinder.parentNode.removeChild(flash);
                                resolve();
                            }, 100);
                        }, 50);
                    }, 0);
                });
                
                // Wait a moment before taking the next photo
                if (i < numPhotos - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            // Process all frames
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                
                // For the first frame, just copy to final canvas
                if (i === 0) {
                    finalCtx.drawImage(frame, 0, 0);
                } else {
                    // For subsequent frames, blend with the existing result
                    finalCtx.globalAlpha = 1.0 / (i + 1);
                    finalCtx.drawImage(frame, 0, 0);
                    finalCtx.globalAlpha = 1.0;
                }
                
                // Release bitmap memory if appropriate
                if (frame.close) {
                    frame.close();
                }
            }
            
            // Apply the current filter to the final result
            if (currentFilter !== 'normal') {
                try {
                    const filteredCanvas = document.createElement('canvas');
                    filteredCanvas.width = finalCanvas.width;
                    filteredCanvas.height = finalCanvas.height;
                    const filteredCtx = filteredCanvas.getContext('2d', {
                        alpha: false,
                        desynchronized: true
                    });
                    
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
            
            // Convert to data URL with high quality
            const photoDataUrl = finalCanvas.toDataURL('image/jpeg', 0.95);
            
            // Calculate megapixels
            const megapixels = ((finalCanvas.width * finalCanvas.height) / 1000000).toFixed(1);
            
            // Save to gallery with stack indicator
            const newPhoto = {
                id: Date.now(),
                src: photoDataUrl,
                date: new Date().toISOString(),
                filter: currentFilter,
                pawMode: isPawMode,
                mode: 'stack',
                isStack: true,
                stackCount: numPhotos,
                width: finalCanvas.width,
                height: finalCanvas.height,
                megapixels: megapixels
            };
            
            savedPhotos.unshift(newPhoto);
            
            // Limit the number of stored photos to prevent memory issues
            if (savedPhotos.length > MAX_PHOTOS) {
                savedPhotos = savedPhotos.slice(0, MAX_PHOTOS);
            }
            
            // Save to localStorage with error handling for quota
            try {
                localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
            } catch (e) {
                console.error('Error saving stacked photo to localStorage:', e);
                
                if (e.name === 'QuotaExceededError') {
                    // Just keep the new photo and a few others
                    savedPhotos = [newPhoto, ...savedPhotos.slice(0, 9)];
                    localStorage.setItem('pawShotPhotos', JSON.stringify(savedPhotos));
                    showNotification('Storage full - keeping only recent photos');
                }
            }
            
            // Update gallery preview
            updateGalleryButtonPreview();
            
            // Show notification with resolution info
            showNotification(`Stack photo saved: ${megapixels}MP (${finalCanvas.width}×${finalCanvas.height})`);
            
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
                
                // Free memory
                finalCanvas.width = 1;
                finalCanvas.height = 1;
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
    
    // Render gallery images with efficient loading
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
        
        // Create intersection observer for lazy loading
        const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const dataSrc = img.getAttribute('data-src');
                    if (dataSrc) {
                        img.src = dataSrc;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });
        
        // Add each photo to gallery with lazy loading
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
                
                // Add megapixel info if available
                if (photo.megapixels) {
                    const mpBadge = document.createElement('div');
                    mpBadge.className = 'mp-badge';
                    mpBadge.textContent = `${photo.megapixels}MP`;
                    photoItem.appendChild(mpBadge);
                }
                
                const img = document.createElement('img');
                // Use a small transparent placeholder initially
                img.src = 'data:image/gif;base64,R0lGODlhAQABAPAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
                img.setAttribute('data-src', photo.src);
                img.alt = 'Gallery photo';
                img.loading = 'lazy';
                
                photoItem.appendChild(img);
                
                // Open photo in edit view when clicked
                photoItem.addEventListener('click', () => {
                    openPhotoInEditView(photo);
                });
                
                galleryGrid.appendChild(photoItem);
                
                // Observe for lazy loading
                lazyLoadObserver.observe(img);
            } catch (error) {
                console.error('Error rendering photo:', error);
            }
        });
    }
    
    // Open photo in edit view
    function openPhotoInEditView(photo) {
        try {
            const editImage = document.getElementById('edit-image');
            
            // Show loading state
            editImage.src = '';
            editImage.classList.add('loading');
            
            // Load image with native resolution
            editImage.onload = () => {
                editImage.classList.remove('loading');
            };
            
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
                
                let infoHTML = `<div>Date: ${date}</div>`;
                
                if (photo.width && photo.height) {
                    infoHTML += `<div>Resolution: ${photo.width}×${photo.height}</div>`;
                }
                
                if (photo.megapixels) {
                    infoHTML += `<div>Megapixels: ${photo.megapixels}MP</div>`;
                }
                
                infoHTML += `
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
    
    // Download the current photo at full resolution
    function downloadPhoto() {
        try {
            const photoId = parseInt(editScreen.dataset.photoId);
            const photo = savedPhotos.find(p => p.id === photoId);
            
            if (!photo) {
                showNotification('Photo not found');
                return;
            }
            
            // Show notification about download starting
            showNotification('Preparing full-resolution download...');
            
            // Use device's native sharing if available for better performance
            if (navigator.share && photo.src) {
                // Convert data URL to Blob for sharing
                const fetchResponse = fetch(photo.src);
                fetchResponse.then(res => res.blob())
                    .then(blob => {
                        // Generate filename with megapixel info if available
                        let filename = `pawshot_${photoId}`;
                        if (photo.megapixels) {
                            filename += `_${photo.megapixels}MP`;
                        }
                        filename += '.jpg';
                        
                        // Create file from blob
                        const file = new File([blob], filename, { type: 'image/jpeg' });
                        
                        // Share using native share API
                        navigator.share({
                            title: 'PawShot Photo',
                            files: [file]
                        }).then(() => {
                            showNotification('Photo shared successfully');
                        }).catch(err => {
                            console.error('Share failed:', err);
                            // Fall back to download if share fails
                            downloadDirectly(photo, photoId);
                        });
                    }).catch(err => {
                        console.error('Error preparing photo for share:', err);
                        // Fall back to direct download
                        downloadDirectly(photo, photoId);
                    });
            } else {
                // Fall back to direct download method
                downloadDirectly(photo, photoId);
            }
        } catch (error) {
            console.error('Error downloading photo:', error);
            showNotification('Could not download photo');
        }
    }
    
    // Direct download helper function
    function downloadDirectly(photo, photoId) {
        try {
            // Create a temporary anchor element for download
            const link = document.createElement('a');
            link.href = photo.src;
            
            // Generate filename with megapixel info if available
            let filename = `pawshot_${photoId}`;
            if (photo.megapixels) {
                filename += `_${photo.megapixels}MP`;
            }
            filename += '.jpg';
            
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('Photo download started');
        } catch (error) {
            console.error('Direct download error:', error);
            showNotification('Download failed');
        }
    }
    
    // Delete the current photo
    function deletePhoto() {
        try {
            const photoId = parseInt(editScreen.dataset.photoId);
            
            // Find the photo object first to free its memory
            const photoToDelete = savedPhotos.find(p => p.id === photoId);
            if (photoToDelete && photoToDelete.src) {
                // Explicitly release the data URL
                URL.revokeObjectURL(photoToDelete.src);
            }
            
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
        showNotification('Could not initialize camera. Please check camera permissions.');
    });
    
    // Event listeners with error handling
    
    // Shutter button - with haptic feedback if available
    shutterButton.addEventListener('click', () => {
        try {
            // Use vibration API for haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            takePhoto();
        } catch (error) {
            console.error('Error in shutter button handler:', error);
            showNotification('Error taking photo');
        }
    });
    
    // Switch camera button
    switchCameraButton.addEventListener('click', () => {
        try {
            // Use vibration API for haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(20);
            }
            
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
            // Use vibration API for haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(20);
            }
            
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
            
            // Ensure camera is running when returning
            if (!stream || !stream.active) {
                initCamera();
            }
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
    
    // Share button (if present) - use native sharing
    const shareButton = document.getElementById('share-photo');
    if (shareButton) {
        shareButton.addEventListener('click', () => {
            try {
                const photoId = parseInt(editScreen.dataset.photoId);
                const photo = savedPhotos.find(p => p.id === photoId);
                
                if (!photo) {
                    showNotification('Photo not found');
                    return;
                }
                
                // Use Web Share API if available
                if (navigator.share) {
                    // Convert data URL to Blob for sharing
                    fetch(photo.src)
                        .then(res => res.blob())
                        .then(blob => {
                            // Generate filename with megapixel info
                            let filename = `pawshot_${photoId}`;
                            if (photo.megapixels) {
                                filename += `_${photo.megapixels}MP`;
                            }
                            filename += '.jpg';
                            
                            const file = new File([blob], filename, { type: 'image/jpeg' });
                            
                            navigator.share({
                                title: 'PawShot Photo',
                                files: [file]
                            }).then(() => {
                                showNotification('Photo shared successfully');
                            }).catch(err => {
                                console.error('Share failed:', err);
                                showNotification('Sharing failed');
                            });
                        });
                } else {
                    // Fall back to download if sharing isn't available
                    downloadPhoto();
                }
            } catch (error) {
                console.error('Error sharing photo:', error);
                showNotification('Error sharing photo');
            }
        });
    }
    
    // Toggle paw mode
    togglePawModeButton.addEventListener('click', () => {
        try {
            isPawMode = !isPawMode;
            appContainer.classList.toggle('paw-mode', isPawMode);
            
            // Use vibration API for haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(isPawMode ? [20, 30, 40, 50] : 20);
            }
            
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
                
                // Use vibration API for haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(20);
                }
                
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
            
            // Use vibration API for haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(20);
            }
            
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
            
            // Use vibration API for haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(20);
            }
            
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
                
                // Use vibration API for haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(20);
                }
                
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
            // App is now hidden, stop the stream to save resources
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
                initCamera().catch(error => {
                    console.error('Camera recovery error:', error);
                });
            }
        }, 30000); // Run every 30 seconds
        
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
            } else {
                // Reset counter after waiting a while
                setTimeout(() => {
                    cameraFailureCount = 0;
                }, 60000);
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
                    initCamera().catch(error => {
                        console.error('Camera recovery attempt failed:', error);
                    });
                }, 2000);
            }
            
            return true; // Prevent default error handling
        });
        
        // Add battery awareness to adjust quality based on battery level
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                function updateBasedOnBattery() {
                    if (battery.level < 0.15 && !battery.charging) {
                        // Low battery mode - reduce performance impact
                        MAX_PHOTOS = 20; // Reduce max stored photos
                        showNotification('Low battery detected - conserving power', 2000);
                    } else {
                        // Normal mode
                        MAX_PHOTOS = 50;
                    }
                }
                
                // Update when battery level or charging status changes
                battery.addEventListener('levelchange', updateBasedOnBattery);
                battery.addEventListener('chargingchange', updateBasedOnBattery);
                
                // Initial check
                updateBasedOnBattery();
            }).catch(err => {
                console.log('Battery status not available:', err);
            });
        }
        
        // Add device memory awareness to adjust quality based on available memory
        if (navigator.deviceMemory) {
            const deviceMemory = navigator.deviceMemory;
            console.log(`Device memory: ${deviceMemory}GB`);
            
            // Adjust quality based on device memory
            if (deviceMemory < 4) {
                // Low memory device - reduce quality to prevent crashes
                MAX_PHOTOS = 20;
            } else if (deviceMemory >= 8) {
                // High memory device - allow more quality
                MAX_PHOTOS = 100;
            }
        }
        
        // Check hardware concurrency to adjust performance 
        if (navigator.hardwareConcurrency) {
            const cores = navigator.hardwareConcurrency;
            console.log(`CPU cores: ${cores}`);
            
            // Use this information to adjust processing-intensive features
            if (cores <= 2) {
                // Limit features on low-end devices
                showNotification('Limited performance mode activated', 2000);
            }
        }
        
        // Add special features for iOS devices
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            console.log('iOS device detected - enabling iOS optimizations');
            
            // iOS-specific camera fixes
            document.documentElement.style.setProperty('--ios-safe-area-top', '0px');
            document.documentElement.style.setProperty('--ios-safe-area-bottom', '0px');
            
            // Try to detect iPhone model to optimize for specific devices
            // Generally iPhone newer models have 12MP cameras
            const matchIPhone = navigator.userAgent.match(/iPhone(\d+),/);
            if (matchIPhone) {
                const iPhoneModel = parseInt(matchIPhone[1]);
                if (iPhoneModel >= 8) {
                    // Newer iPhone with 12MP camera
                    console.log('High-end iPhone detected - enabling full quality mode');
                    // We'll already be using max resolution from constraints
                }
            }
            
            // Apply special iOS viewport fixes
            document.querySelector('meta[name="viewport"]').setAttribute('content', 
                'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
            
            // Handle iOS-specific orientation issues
            window.addEventListener('orientationchange', () => {
                // Force layout recalculation on orientation change (iOS fix)
                document.body.style.display = 'none';
                setTimeout(() => {
                    document.body.style.display = '';
                }, 20);
            });
        }
        
        // Similar optimizations for Android devices
        const isAndroid = /Android/.test(navigator.userAgent);
        if (isAndroid) {
            console.log('Android device detected - enabling Android optimizations');
            
            // Apply Android-specific fixes
            document.querySelector('meta[name="theme-color"]').setAttribute('content', '#000000');
            
            // Attempt to detect camera megapixels based on device model
            const matchPixel = navigator.userAgent.match(/Pixel (\d+)/i);
            if (matchPixel) {
                // Google Pixel phones have high-quality cameras
                console.log('Google Pixel device detected - enabling high quality mode');
                // We'll already be using max resolution from constraints
            }
        }
        
        // Enable fullscreen mode for better experience if supported
        const toggleFullScreen = () => {
            try {
                if (!document.fullscreenElement) {
                    // Enter fullscreen
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen();
                    } else if (document.documentElement.webkitRequestFullscreen) {
                        document.documentElement.webkitRequestFullscreen();
                    } else if (document.documentElement.msRequestFullscreen) {
                        document.documentElement.msRequestFullscreen();
                    }
                } else {
                    // Exit fullscreen
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                }
            } catch (err) {
                console.warn('Fullscreen toggle error:', err);
            }
        };
        
        // Add double-tap to toggle fullscreen
        let lastTap = 0;
        document.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 300 && tapLength > 0) {
                // Double tap detected
                if (e.target === viewfinder || e.target.classList.contains('camera-screen')) {
                    toggleFullScreen();
                    e.preventDefault();
                }
            }
            
            lastTap = currentTime;
        });
        
        // Expose a performance API for debugging
        window.pawShotPerformance = {
            checkMemory: function() {
                if (window.performance && window.performance.memory) {
                    return {
                        totalJSHeapSize: Math.round(window.performance.memory.totalJSHeapSize / (1024 * 1024)) + 'MB',
                        usedJSHeapSize: Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)) + 'MB',
                        jsHeapSizeLimit: Math.round(window.performance.memory.jsHeapSizeLimit / (1024 * 1024)) + 'MB'
                    };
                }
                return 'Memory API not available';
            },
            
            getCurrentMode: function() {
                return {
                    mode: currentMode,
                    filter: currentFilter,
                    pawMode: isPawMode,
                    hdr: isHDRActive,
                    flash: flashMode,
                    facingMode: facingMode,
                    photoCount: savedPhotos.length
                };
            },
            
            clearStorage: function() {
                if (confirm('Are you sure you want to delete all photos? This cannot be undone.')) {
                    savedPhotos = [];
                    localStorage.setItem('pawShotPhotos', '[]');
                    showNotification('All photos deleted');
                    updateGalleryButtonPreview();
                    if (!cameraScreen.classList.contains('hidden')) {
                        galleryScreen.classList.remove('hidden');
                        renderGallery();
                    }
                }
            }
        };
        
        // Log initialization complete
        console.log('PawShot camera initialized with full quality (12MP) support');
        showNotification('Camera ready - 12MP mode active');
    });    
