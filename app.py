from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, join_room, leave_room, emit
import secrets
import uuid
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store room information with additional metadata
rooms = {}  # Format: {room_id: {'users': set(), 'host': None, 'pending_requests': set(), 'created_at': timestamp}}

def cleanup_empty_rooms():
    empty_rooms = [room_id for room_id, room_data in rooms.items() if not room_data['users']]
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
            'created_at': datetime.now()
        }

    return jsonify({'room_id': room_id})

@app.route('/room/<room_id>')
def room(room_id):
    if room_id not in rooms:
        return "Room not found", 404
    return render_template('room.html', room_id=room_id)

@socketio.on('join-room')
def on_join_room(data):
    room = data.get('room')
    username = data.get('username')

    if not room or not username:
        return

    join_room(room)
    rooms[room] = rooms.get(room, {'users': set(), 'host': None, 'pending_requests': set(), 'created_at': datetime.now()})
    rooms[room]['users'].add(request.sid)  # Store session ID instead of username
    connected_users[username] = request.sid  # Map username to session ID

    # Notify other users in the room
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
    if room in rooms:
        # Broadcast the message data to all users in the room except the sender
        emit('chat-message', {'messageData': data['messageData']}, room=room, include_self=False)

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
                del rooms[room_id]

@socketio.on('disconnect')
def handle_disconnect():
    # Find the username associated with this session
    username_to_remove = None
    for username, sid in connected_users.items():
        if sid == request.sid:
            username_to_remove = username
            break

    # Remove user from all rooms they're in
    for room_id in rooms:
        room = rooms[room_id]
        if request.sid in room['users']:
            room['users'].remove(request.sid)

            if username_to_remove:
                del connected_users[username_to_remove]
                emit('user-disconnected', {'username': username_to_remove}, room=room_id)

            # If room is empty, remove it
            if not room['users']:
                del rooms[room_id]

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
