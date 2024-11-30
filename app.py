from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit
import secrets
import uuid
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store room information with additional metadata
rooms = {}  # Format: {room_id: {'users': set(), 'host': None, 'pending_requests': set(), 'created_at': timestamp, 'grace_period': None}}

def start_room_grace_period(room_id):
    """Start a grace period for an empty room"""
    if room_id in rooms:
        rooms[room_id]['grace_period'] = datetime.now()

def check_room_grace_period(room_id):
    """Check if room's grace period has expired (10 seconds)"""
    if room_id not in rooms or 'grace_period' not in rooms[room_id] or not rooms[room_id]['grace_period']:
        return False
    
    grace_period = rooms[room_id]['grace_period']
    return (datetime.now() - grace_period).total_seconds() <= 10

def cleanup_empty_rooms():
    """Clean up rooms that are empty and have exceeded their grace period"""
    current_time = datetime.now()
    empty_rooms = []
    
    for room_id, room_data in rooms.items():
        if not room_data['users']:
            if 'grace_period' not in room_data or not room_data['grace_period']:
                start_room_grace_period(room_id)
            elif (current_time - room_data['grace_period']).total_seconds() > 10:
                empty_rooms.append(room_id)
    
    for room_id in empty_rooms:
        del rooms[room_id]

connected_users = {}

@app.route('/get-rooms')
def get_rooms():
    # Clean up empty rooms first
    cleanup_empty_rooms()
    # Get active rooms with their user count
    active_rooms = {
        room_id: {
            'user_count': len(room_data['users']),
            'host': room_data['host']
        }
        for room_id, room_data in rooms.items()
    }
    return jsonify({'rooms': active_rooms})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/create-room', methods=['POST'])
def create_room():
    username = request.form.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400

    room_id = request.form.get('room_id')
    if not room_id:
        room_id = str(uuid.uuid4())

    if room_id not in rooms:
        rooms[room_id] = {
            'users': set(),
            'host': username,
            'pending_requests': set(),
            'created_at': datetime.now(),
            'grace_period': None
        }

    return jsonify({'room_id': room_id})

@app.route('/room/<room_id>')
def room(room_id):
    cleanup_empty_rooms()
    if room_id not in rooms:
        return "Room not found", 404
    return render_template('room.html', room_id=room_id)

@socketio.on('join-room')
def on_join_room(data):
    room = data.get('room')
    username = data.get('username')

    if not room or not username:
        return

    # Reset grace period when someone joins
    if room in rooms and 'grace_period' in rooms[room]:
        rooms[room]['grace_period'] = None

    join_room(room)
    rooms[room] = rooms.get(room, {
        'users': set(),
        'host': None,
        'pending_requests': set(),
        'created_at': datetime.now(),
        'grace_period': None
    })
    rooms[room]['users'].add(request.sid)
    connected_users[username] = request.sid

    emit('user-joined', {'username': username}, room=room, include_self=False)

@socketio.on('offer')
def on_offer(data):
    if 'offer' in data and 'room' in data:
        emit('offer', {'offer': data['offer']}, room=data['room'], include_self=False)

@socketio.on('answer')
def on_answer(data):
    if 'answer' in data and 'room' in data:
        emit('answer', {'answer': data['answer']}, room=data['room'], include_self=False)

@socketio.on('ice-candidate')
def on_ice_candidate(data):
    if 'candidate' in data and 'room' in data:
        emit('ice-candidate', {'candidate': data['candidate']}, room=data['room'], include_self=False)

@socketio.on('chat-message')
def handle_chat_message(data):
    room = data['room']
    print(f"Received chat message in room {room}: {data['messageData']}")
    print(f"Current room users: {rooms[room]['users'] if room in rooms else 'Room not found'}")
    print(f"Sender SID: {request.sid}")
    
    if room in rooms:
        # Broadcast the message data to all users in the room except the sender
        print(f"Broadcasting message to room {room}")
        emit('chat-message', {'messageData': data['messageData']}, room=room, include_self=False)
        print(f"Message broadcast complete")

@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data.get('room_id')
    username = data.get('username')

    if room_id in rooms:
        room = rooms[room_id]
        if request.sid in room['users']:
            room['users'].remove(request.sid)
            if username in connected_users:
                del connected_users[username]

            # Notify others in the room
            emit('user-disconnected', {'username': username}, room=room_id)
            leave_room(room_id)

            # Clean up empty room
            if not room['users']:
                start_room_grace_period(room_id)

@socketio.on('disconnect')
def handle_disconnect():
    # Find and remove user from all rooms they're in
    for room_id, room_data in rooms.items():
        if request.sid in room_data['users']:
            room_data['users'].remove(request.sid)
            # Start grace period if room is now empty
            if not room_data['users']:
                start_room_grace_period(room_id)
            break

    # Remove user from connected users
    for username, sid in list(connected_users.items()):
        if sid == request.sid:
            del connected_users[username]
            emit('user-left', {'username': username}, room=room_id)
            break

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
