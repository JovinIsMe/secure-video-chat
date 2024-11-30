# Secure Video Chat

A modern, feature-rich video chat application built with WebRTC, Flask, and Socket.IO. This application provides a secure, real-time video communication platform with advanced video controls and chat functionality.

## Features

### Video Communication
- Real-time video and audio streaming using WebRTC
- Screen sharing capability
- Device selection for camera and microphone
- Video/Audio mute controls

### Advanced Video Controls
- Dynamic zoom controls (1x to 3x zoom)
- Smooth video panning with multiple input methods:
  - Mouse: Click and hold directional buttons
  - Touch: Touch and hold for mobile devices
  - Keyboard: Arrow keys for precise control
- Game-like D-pad style controller interface

### Chat Features
- Real-time text chat alongside video
- Username-based identification
- Message timestamps
- Persistent chat history during session

### User Interface
- Modern, responsive design using Tailwind CSS
- Adaptive layout for both desktop and mobile devices
- Intuitive control buttons with visual feedback
- Clean, minimalist aesthetic

## Technical Stack

### Frontend
- HTML5/CSS3/JavaScript
- Tailwind CSS for styling
- Socket.IO client for real-time communication
- WebRTC for peer-to-peer video streaming

### Backend
- Flask (Python web framework)
  - Serves as the web server for delivering HTML, CSS, and JavaScript
  - Acts as a signaling server for WebRTC peer connection setup
  - Manages room creation and user sessions
  - Routes users to appropriate video chat rooms
- Socket.IO for real-time communication
  - Handles real-time message exchange for WebRTC signaling
  - Manages chat functionality between users
- STUN/TURN servers for NAT traversal

## Getting Started

### Prerequisites
- Python 3.8+
- Modern web browser with WebRTC support

### Installation

1. Clone the repository:
```bash
git clone https://github.com/JovinIsMe/secure-video-chat.git
cd secure-video-chat
```

2. Create and activate a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip3 install -r requirements.txt
```

4. Start the application:
```bash
python3 app.py
```

5. Visit `http://localhost:5000` in your browser

## Usage

1. Enter your username on the home page
2. Create or join a room
3. Allow camera and microphone access when prompted
   - You may need to whitelist the app on Chrome `chrome://flags/` for `Insecure origins treated as secure` so it can allow the camera and microphone usage
4. Use the control buttons to:
   - Toggle video/audio
   - Share screen
   - Access video controls (zoom/pan)
   - Change input devices
   - Send chat messages

### Video Control Features
- Click the video controls button to access zoom and pan options
- Use the zoom buttons to adjust video size (100% to 300%)
- Pan the zoomed video using:
  - On-screen D-pad buttons
  - Keyboard arrow keys
  - Touch and drag (mobile)

## Security Features
- Secure WebRTC connections
- Random room IDs
- No permanent storage of video/audio data
- Client-side security measures

## Browser Support
- Chrome (recommended)
- Firefox
- Safari
- Edge (Chromium-based)

## Contributing
Contributions are welcome! Please feel free to submit pull requests.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- WebRTC project for the underlying technology
- Flask team for the web framework
- Socket.IO team for real-time communication capabilities
- Tailwind CSS for the UI framework
