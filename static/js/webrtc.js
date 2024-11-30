// Ensure browser compatibility for older browsers
if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
}

// Polyfill getUserMedia
if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
        const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

        if (!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        return new Promise((resolve, reject) => {
            getUserMedia.call(navigator, constraints, resolve, reject);
        });
    };
}

class SecureVideoChat {
    constructor(roomId, username) {
        this.roomId = roomId;
        this.username = username;
        this.socket = io();
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isInitiator = false;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        this.originalStream = null;  // Store the original camera stream
        this.isNegotiating = false;
        this.pendingCandidates = [];
        this.currentVideoDevice = null;
        this.currentAudioDevice = null;

        console.log(`WebRTC initialized for user ${username} in room ${roomId}`);

        this.initializeConnection();
        this.setupChatEvents();
        this.setupMediaControls();
        this.setupDeviceSettings();
    }

    async initializeConnection() {
        try {
            // Get user media with constraints
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Show local video
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;
            await localVideo.play().catch(e => console.log('Play error:', e));

            // Setup WebRTC and Socket events
            this.setupPeerConnection();
            this.setupSocketEvents();

            // Join room
            this.socket.emit('join-room', {
                room: this.roomId,
                username: this.username
            });

        } catch (error) {
            console.error('Error initializing connection:', error);
        }
    }

    setupSocketEvents() {
        this.socket.on('user-joined', async (data) => {
            console.log('User joined:', data);
            if (!this.peerConnection || this.peerConnection.connectionState === 'closed') {
                this.setupPeerConnection();
            }
            this.isInitiator = true;
            await this.createAndSendOffer();
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.showError('Connection error. Redirecting to home page...');
            setTimeout(() => window.location.href = '/', 2000);
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.showError('Connection lost. Redirecting to home page...');
            setTimeout(() => window.location.href = '/', 2000);
        });

        this.socket.on('room_closed', () => {
            console.log('Room has been closed');
            this.showError('Room has been closed. Redirecting to home page...');
            setTimeout(() => window.location.href = '/', 2000);
        });

        this.socket.on('error', (data) => {
            console.error('Socket error:', data.message);
            this.showError(data.message);
            setTimeout(() => window.location.href = '/', 2000);
        });

        this.socket.on('offer', async (data) => {
            console.log('Received offer');
            if (!this.peerConnection || this.peerConnection.connectionState === 'closed') {
                this.setupPeerConnection();
            }
            if (!this.isNegotiating) {
                this.isNegotiating = true;
                await this.handleOfferAndSendAnswer(data.offer);
                // Process any pending candidates after setting remote description
                while (this.pendingCandidates.length > 0) {
                    const candidate = this.pendingCandidates.shift();
                    await this.handleIceCandidate(candidate);
                }
                this.isNegotiating = false;
            }
        });

        this.socket.on('answer', async (data) => {
            console.log('Received answer');
            if (this.peerConnection && !this.isNegotiating) {
                this.isNegotiating = true;
                await this.handleAnswer(data.answer);
                // Process any pending candidates after setting remote description
                while (this.pendingCandidates.length > 0) {
                    const candidate = this.pendingCandidates.shift();
                    await this.handleIceCandidate(candidate);
                }
                this.isNegotiating = false;
            }
        });

        this.socket.on('ice-candidate', async (data) => {
            console.log('Received ICE candidate');
            if (!this.peerConnection || !this.peerConnection.remoteDescription) {
                // If we don't have a remote description yet, queue the candidate
                console.log('Queueing ICE candidate');
                this.pendingCandidates.push(data.candidate);
            } else {
                await this.handleIceCandidate(data.candidate);
            }
        });

        this.socket.on('user-disconnected', () => {
            console.log('User disconnected');
            this.handlePeerDisconnection();
        });

        // Chat message handler
        this.socket.on('chat-message', (data) => {
            console.log('Received chat message event:', data);
            console.log('Current username:', this.username);
            console.log('Message username:', data.messageData.username);
            this.displayChatMessage(data.messageData, false);
        });

        this.socket.on('room-not-found', () => {
            console.log('Room not found');
            window.location.href = '/';
        });
    }

    setupPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        // Add local tracks to the peer connection
        this.localStream.getTracks().forEach(track => {
            console.log('Adding local track:', track.kind);
            this.peerConnection.addTrack(track, this.localStream);
        });

        // Handle remote tracks
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind);
            const remoteVideo = document.getElementById('remoteVideo');
            const remoteVideoPlaceholder = document.getElementById('remoteVideoPlaceholder');
            if (remoteVideo.srcObject !== event.streams[0]) {
                console.log('Setting remote stream');
                remoteVideo.srcObject = event.streams[0];
                remoteVideoPlaceholder.style.display = 'none';
                this.remoteStream = event.streams[0];
            }
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    room: this.roomId
                });
            }
        };

        // Log connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE Connection State:', this.peerConnection.iceConnectionState);
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection State:', this.peerConnection.connectionState);
        };
    }

    async createAndSendOffer() {
        try {
            console.log('Creating offer as initiator');
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await this.peerConnection.setLocalDescription(offer);

            this.socket.emit('offer', {
                offer: offer,
                room: this.roomId
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    async handleOfferAndSendAnswer(offer) {
        try {
            console.log('Handling offer and creating answer');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('answer', {
                answer: answer,
                room: this.roomId
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(answer) {
        try {
            console.log('Setting remote description from answer');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    handlePeerDisconnection() {
        const remoteVideo = document.getElementById('remoteVideo');
        const remoteVideoPlaceholder = document.getElementById('remoteVideoPlaceholder');
        if (remoteVideo.srcObject) {
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
            remoteVideo.srcObject = null;
        }
        remoteVideoPlaceholder.style.display = 'flex';

        if (this.peerConnection) {
            this.peerConnection.close();
        }

        // Reset connection
        this.peerConnection = null;
        this.isInitiator = false;
        this.setupPeerConnection();
    }

    setupChatEvents() {
        const form = document.getElementById('chat-form');
        const messageInput = document.getElementById('messageInput');

        // Handle form submission (both Enter key and button click)
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const message = messageInput.value.trim();
            if (message) {
                this.sendChatMessage(message);
                messageInput.value = '';
                messageInput.focus(); // Keep focus on input after sending
            }
        });

        // Additional Enter key handler for better compatibility
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form.requestSubmit(); // This triggers the form's submit event
            }
        });
    }

    sendChatMessage(message) {
        if (!message.trim()) return;

        const messageData = {
            username: this.username,
            message: message,
            timestamp: new Date().toISOString()
        };

        console.log('Preparing to send chat message:', messageData);
        console.log('Current room:', this.roomId);

        // Display own message first
        this.displayChatMessage(messageData, true);

        // Then emit the message
        console.log('Emitting chat message to server');
        this.socket.emit('chat-message', {
            room: this.roomId,
            messageData: messageData
        });
        console.log('Chat message emitted');
    }

    displayChatMessage(data, isOwnMessage = false) {
        console.log('Displaying chat message:', data);
        console.log('Is own message:', isOwnMessage);

        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} mb-4`;

        const messageContent = document.createElement('div');
        messageContent.className = `max-w-[70%] rounded-lg p-3 ${
            isOwnMessage ?
            'bg-blue-600 text-white' :
            'bg-gray-700 text-gray-200'
        }`;

        const usernameSpan = document.createElement('div');
        usernameSpan.className = 'text-sm font-semibold mb-1';
        usernameSpan.textContent = data.username;

        const messageText = document.createElement('div');
        messageText.className = 'break-words';
        messageText.textContent = data.message;

        const timestamp = document.createElement('div');
        timestamp.className = 'text-xs text-gray-400 mt-1';
        timestamp.textContent = new Date(data.timestamp).toLocaleTimeString();

        messageContent.appendChild(usernameSpan);
        messageContent.appendChild(messageText);
        messageContent.appendChild(timestamp);
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    setupMediaControls() {
        const toggleVideo = document.getElementById('toggleVideo');
        const toggleAudio = document.getElementById('toggleAudio');
        const toggleScreen = document.getElementById('toggleScreen');
        const leaveRoom = document.getElementById('leaveRoom');

        if (toggleVideo) {
            toggleVideo.addEventListener('click', () => this.toggleVideo());
        }
        if (toggleAudio) {
            toggleAudio.addEventListener('click', () => this.toggleAudio());
        }
        if (toggleScreen) {
            // Remove any existing event listeners
            const newToggleScreen = toggleScreen.cloneNode(true);
            toggleScreen.parentNode.replaceChild(newToggleScreen, toggleScreen);
            newToggleScreen.addEventListener('click', () => this.toggleScreenShare());
        }
        if (leaveRoom) {
            leaveRoom.addEventListener('click', () => this.leaveRoom());
        }
    }

    async setupDeviceSettings() {
        const deviceModal = document.getElementById('deviceModal');
        const deviceSettings = document.getElementById('deviceSettings');
        const closeDeviceModal = document.getElementById('closeDeviceModal');
        const videoSelect = document.getElementById('videoSource');
        const audioSelect = document.getElementById('audioSource');
        const applyButton = document.getElementById('applyDeviceSettings');

        // Show modal when clicking settings button
        deviceSettings.addEventListener('click', () => {
            deviceModal.classList.remove('hidden');
            this.updateDeviceList();
        });

        // Hide modal when clicking close button
        closeDeviceModal.addEventListener('click', () => {
            deviceModal.classList.add('hidden');
        });

        // Hide modal when clicking outside
        deviceModal.addEventListener('click', (e) => {
            if (e.target === deviceModal) {
                deviceModal.classList.add('hidden');
            }
        });

        // Apply device changes
        applyButton.addEventListener('click', async () => {
            const videoSource = videoSelect.value;
            const audioSource = audioSelect.value;
            await this.updateMediaStream(videoSource, audioSource);
            deviceModal.classList.add('hidden');
        });
    }

    async updateDeviceList() {
        const videoSelect = document.getElementById('videoSource');
        const audioSelect = document.getElementById('audioSource');

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();

            // Clear previous options
            videoSelect.innerHTML = '';
            audioSelect.innerHTML = '';

            // Add video devices
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${videoSelect.length + 1}`;
                if (this.currentVideoDevice === device.deviceId) {
                    option.selected = true;
                }
                videoSelect.appendChild(option);
            });

            // Add audio devices
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            audioDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microphone ${audioSelect.length + 1}`;
                if (this.currentAudioDevice === device.deviceId) {
                    option.selected = true;
                }
                audioSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }

    async updateMediaStream(videoSource, audioSource) {
        try {
            // Stop all tracks in the current stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            // Get new stream with selected devices
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: videoSource ? { deviceId: { exact: videoSource } } : true,
                audio: audioSource ? { deviceId: { exact: audioSource } } : true
            });

            this.currentVideoDevice = videoSource;
            this.currentAudioDevice = audioSource;

            // Replace tracks in the peer connection
            if (this.peerConnection) {
                const senders = this.peerConnection.getSenders();
                const videoTrack = newStream.getVideoTracks()[0];
                const audioTrack = newStream.getAudioTracks()[0];

                const videoSender = senders.find(sender => sender.track?.kind === 'video');
                const audioSender = senders.find(sender => sender.track?.kind === 'audio');

                if (videoSender && videoTrack) {
                    await videoSender.replaceTrack(videoTrack);
                }
                if (audioSender && audioTrack) {
                    await audioSender.replaceTrack(audioTrack);
                }
            }

            // Update local stream and video element
            this.localStream = newStream;
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = newStream;
            }

            // Maintain mute states
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = this.isVideoEnabled;
            });
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = this.isAudioEnabled;
            });
        } catch (error) {
            console.error('Error updating media stream:', error);
        }
    }

    leaveRoom() {
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Emit leave room event
        this.socket.emit('leave_room', {
            room_id: this.roomId,
            username: this.username
        });

        // Redirect to home page
        window.location.href = '/';
    }

    toggleVideo() {
        this.isVideoEnabled = !this.isVideoEnabled;
        const toggleVideoBtn = document.getElementById('toggleVideo');

        if (this.isVideoEnabled) {
            toggleVideoBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            toggleVideoBtn.classList.add('bg-gray-800', 'hover:bg-gray-700');
        } else {
            toggleVideoBtn.classList.remove('bg-gray-800', 'hover:bg-gray-700');
            toggleVideoBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        }

        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = this.isVideoEnabled;
        });
    }

    toggleAudio() {
        this.isAudioEnabled = !this.isAudioEnabled;
        const toggleAudioBtn = document.getElementById('toggleAudio');

        if (this.isAudioEnabled) {
            toggleAudioBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            toggleAudioBtn.classList.add('bg-gray-800', 'hover:bg-gray-700');
        } else {
            toggleAudioBtn.classList.remove('bg-gray-800', 'hover:bg-gray-700');
            toggleAudioBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        }

        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = this.isAudioEnabled;
        });
    }

    async toggleScreenShare() {
        try {
            if (this.isScreenSharing) {
                await this.stopScreenSharing();
                return;
            }

            const screenShareIcon = document.getElementById('screenShareIcon');
            const screenShareOffIcon = document.getElementById('screenShareOffIcon');

            // Start screen sharing
            let screenStream;
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
            } catch (err) {
                // User cancelled the screen share prompt
                if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
                    console.log('Screen sharing was cancelled');
                    return;
                }
                throw err; // Re-throw other errors
            }

            // Store the original stream and replace with screen share stream
            this.originalStream = this.localStream;
            this.localStream = screenStream;

            // Update local video display
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = screenStream;

            // Replace the video track in the peer connection
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }

            // Listen for when user stops screen sharing using the browser controls
            videoTrack.addEventListener('ended', () => {
                if (this.isScreenSharing) {  // Only handle if we're still screen sharing
                    this.stopScreenSharing();
                }
            });

            screenShareIcon.classList.add('hidden');
            screenShareOffIcon.classList.remove('hidden');
            this.isScreenSharing = true;

        } catch (error) {
            console.error('Error toggling screen share:', error);
            await this.stopScreenSharing();
        }
    }

    async stopScreenSharing() {
        const screenShareIcon = document.getElementById('screenShareIcon');
        const screenShareOffIcon = document.getElementById('screenShareOffIcon');

        // Stop all tracks in the screen sharing stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Restore original camera stream
        if (this.originalStream) {
            this.localStream = this.originalStream;
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.originalStream;

            // Replace the video track in the peer connection
            const videoTrack = this.originalStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender && videoTrack) {
                await sender.replaceTrack(videoTrack);
            }
        }

        screenShareIcon.classList.remove('hidden');
        screenShareOffIcon.classList.add('hidden');
        this.isScreenSharing = false;
        this.originalStream = null;
    }

    showError(message) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'fixed top-20 right-4 z-50 flash-message px-4 py-3 rounded-lg shadow-lg bg-red-500 text-white';
        errorContainer.innerHTML = `
            <div class="flex items-center">
                <div class="py-1">
                    <svg class="h-6 w-6 text-white mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <p class="font-bold">${message}</p>
                </div>
            </div>
        `;
        document.body.appendChild(errorContainer);
        
        // Remove the error message after animation
        setTimeout(() => {
            errorContainer.remove();
        }, 5000);
    }
}
