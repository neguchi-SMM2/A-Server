from flask import Flask, request, jsonify
from flask_socketio import SocketIO
import eventlet

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# データを保存する辞書
stored_data = {}

@app.route('/')
def index():
    return "WebSocket Server is running!"

# クライアントからのメッセージを受信してデータを保存
@socketio.on('save_data')
def handle_save(data):
    key = data.get("key")
    value = data.get("value")
    
    if key and value is not None:
        stored_data[key] = value
        print(f"Saved: {key} -> {value}")
        socketio.emit('response', {"status": "success", "message": f"Data saved: {key}"})
    else:
        socketio.emit('response', {"status": "error", "message": "Invalid data"})

# クライアントからのデータ取得リクエスト
@socketio.on('get_data')
def handle_get(data):
    key = data.get("key")
    value = stored_data.get(key, "No data found")
    print(f"Requested: {key}, Response: {value}")
    socketio.emit('response', {"key": key, "value": value})

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=10000)