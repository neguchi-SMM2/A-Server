const WebSocket = require('ws');
const fs = require('fs');
const crypto = require('crypto');

const SECRET_KEY = '70sheets_SMM2'; // 🔑 直接ハードコーディング
const DATA_FILE = 'data.json';
const rooms = {}; // 部屋ごとのデータ

// 🔐 AES暗号化
function encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', SECRET_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// 🔓 AES復号化
function decrypt(text) {
    const decipher = crypto.createDecipher('aes-256-cbc', SECRET_KEY);
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 💾 データ保存
function saveData() {
    const encryptedData = encrypt(JSON.stringify(rooms));
    fs.writeFileSync(DATA_FILE, encryptedData, 'utf8');
}

// 💾 データ読み込み
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const encryptedData = fs.readFileSync(DATA_FILE, 'utf8');
            const decryptedData = decrypt(encryptedData);
            Object.assign(rooms, JSON.parse(decryptedData));
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
}

// 初期データ読み込み
loadData();

// WebSocketサーバー作成
const wss = new WebSocket.Server({ port: 10000 });

wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        try {
            const { request_type, username, data, room, order, limit } = JSON.parse(message);

            if (!room) {
                ws.send(JSON.stringify({ status: 'error', message: 'Room name is required' }));
                return;
            }

            if (!rooms[room]) rooms[room] = [];

            switch (request_type) {
                case 'save':
                    rooms[room].push({ username, data, timestamp: Date.now() });
                    saveData();
                    ws.send(JSON.stringify({ status: 'success', message: 'Data saved' }));
                    break;

                case 'get_all':
                    let sortedData = rooms[room].slice();
                    if (order === 'asc') sortedData.sort((a, b) => a.timestamp - b.timestamp);
                    if (order === 'desc') sortedData.sort((a, b) => b.timestamp - a.timestamp);
                    if (limit) sortedData = sortedData.slice(0, limit);
                    ws.send(JSON.stringify({ status: 'success', data: sortedData }));
                    break;

                case 'get_nth':
                    const index = parseInt(data, 10);
                    if (index >= 0 && index < rooms[room].length) {
                        ws.send(JSON.stringify({ status: 'success', data: rooms[room][index] }));
                    } else {
                        ws.send(JSON.stringify({ status: 'error', message: 'Invalid index' }));
                    }
                    break;

                case 'get_user':
                    const userData = rooms[room].filter(entry => entry.username === username);
                    ws.send(JSON.stringify({ status: 'success', data: userData }));
                    break;

                case 'delete_all':
                    rooms[room] = [];
                    saveData();
                    ws.send(JSON.stringify({ status: 'success', message: 'All data deleted' }));
                    break;

                case 'delete_nth':
                    const deleteIndex = parseInt(data, 10);
                    if (deleteIndex >= 0 && deleteIndex < rooms[room].length) {
                        rooms[room].splice(deleteIndex, 1);
                        saveData();
                        ws.send(JSON.stringify({ status: 'success', message: 'Deleted nth data' }));
                    } else {
                        ws.send(JSON.stringify({ status: 'error', message: 'Invalid index' }));
                    }
                    break;

                case 'delete_user':
                    rooms[room] = rooms[room].filter(entry => entry.username !== username);
                    saveData();
                    ws.send(JSON.stringify({ status: 'success', message: 'Deleted user data' }));
                    break;

                default:
                    ws.send(JSON.stringify({ status: 'error', message: 'Invalid request type' }));
                    break;
            }
        } catch (error) {
            ws.send(JSON.stringify({ status: 'error', message: 'Invalid JSON format' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log('WebSocket server running');
