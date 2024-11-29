# Secure Video Chat

A secure, encrypted, peer-to-peer video chat application built with WebRTC and Flask.

## Features

- 🔒 End-to-end encrypted video calls
- 🎥 High-quality video and audio streaming
- 🖥️ Screen sharing capability
- 🔐 Peer-to-peer connection (data never passes through servers)
- 📱 Responsive design for all devices
- 🔗 Easy room sharing with copy link feature
- 🎛️ Audio/Video controls
- ⚡ Low latency communication

## Security Features

- WebRTC's built-in encryption (DTLS-SRTP) for all media streams
- Peer-to-peer architecture ensures data privacy
- No data storage on servers
- Secure room creation with random tokens
- CSRF protection

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Modern web browser with WebRTC support

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd secure-video-chat
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install the required packages:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
export FLASK_APP=app.py
export FLASK_ENV=development
```

5. Run the application:
```bash
flask run
```

The application will be available at `http://localhost:5000`

## Usage

1. Open the application in your browser
2. Click "Create New Room" to start a new video chat room
3. Share the room link with another person
4. When they join, the video call will automatically begin
5. Use the control buttons to:
   - Toggle video on/off
   - Toggle audio on/off
   - Share your screen
   - Leave the call

## Development

The application structure is as follows:

```
secure-video-chat/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── static/
│   ├── css/
│   │   └── style.css  # Custom styles
│   └── js/
│       └── webrtc.js  # WebRTC implementation
└── templates/
    ├── base.html      # Base template
    ├── index.html     # Home page
    └── room.html      # Video chat room
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
