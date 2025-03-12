const fs = require("fs");
const crypto = require("crypto-js");
const WebSocket = require("ws");

const SECRET_KEY = "ILoveRoarVeryMuch_neguchi_SMM2_"; // ここは必ず変更すること！
const DATA_FILE = "data.json";

// WebSocketサーバーの設定
const wss = new WebSocket.Server({ port: 10000 });

// データを暗号化して保存
function encryptData(data) {
    return crypto.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
}

// データを復号化
function decryptData(encryptedData) {
    try {
        const bytes = crypto.AES.decrypt(encryptedData, SECRET_KEY);
        return JSON.parse(bytes.toString(crypto.enc.Utf8));
    } catch (error) {
        console.error("Decryption error:", error);
        return []; // 復号失敗時は空データを返す
    }
}

// ファイルからデータを読み込む
function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const encryptedData = fs.readFileSync(DATA_FILE, "utf8");
        return decryptData(encryptedData);
    } catch (error) {
        console.error("Error loading data:", error);
        return {};
    }
}

// ファイルにデータを保存
function saveData(data) {
    try {
        const encryptedData = encryptData(data);
        fs.writeFileSync(DATA_FILE, encryptedData, "utf8");
    } catch (error) {
        console.error("Error saving data:", error);
    }
}

// データを管理するオブジェクト（初期化）
let database = loadData();

wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
        try {
            const { request_type, username, data, room, order, limit, index } = JSON.parse(message);

            // roomが指定されていない場合は "default" を使用
            const roomName = room || "default";
            if (!database[roomName]) database[roomName] = [];

            switch (request_type) {
                case "save":
                    database[roomName].push({ username, data, timestamp: Date.now() });
                    saveData(database);
                    ws.send(JSON.stringify({ status: "success", message: "Data saved!" }));
                    break;

                case "get":
                    let roomData = [...(database[roomName] || [])];

                    // 昇順 or 降順
                    if (order === "desc") {
                        roomData.sort((a, b) => b.timestamp - a.timestamp);
                    } else {
                        roomData.sort((a, b) => a.timestamp - b.timestamp);
                    }

                    // クライアントが件数を指定した場合、その数だけ送信
                    const limitedData = limit ? roomData.slice(0, limit) : roomData;
                    ws.send(JSON.stringify({ status: "success", data: limitedData }));
                    break;

                case "get_nth":
                    if (index !== undefined && database[roomName][index]) {
                        ws.send(JSON.stringify({ status: "success", data: database[roomName][index] }));
                    } else {
                        ws.send(JSON.stringify({ status: "error", message: "Invalid index" }));
                    }
                    break;

                case "get_by_user":
                    const userData = (database[roomName] || []).filter(entry => entry.username === username);
                    ws.send(JSON.stringify({ status: "success", data: userData }));
                    break;

                case "delete_all":
                    database[roomName] = [];
                    saveData(database);
                    ws.send(JSON.stringify({ status: "success", message: "All data deleted" }));
                    break;

                case "delete_nth":
                    if (index !== undefined && database[roomName][index]) {
                        database[roomName].splice(index, 1);
                        saveData(database);
                        ws.send(JSON.stringify({ status: "success", message: "Nth data deleted" }));
                    } else {
                        ws.send(JSON.stringify({ status: "error", message: "Invalid index" }));
                    }
                    break;

                case "delete_by_user":
                    database[roomName] = (database[roomName] || []).filter(entry => entry.username !== username);
                    saveData(database);
                    ws.send(JSON.stringify({ status: "success", message: `All data from ${username} deleted` }));
                    break;

                default:
                    ws.send(JSON.stringify({ status: "error", message: "Invalid request type" }));
            }
        } catch (error) {
            ws.send(JSON.stringify({ status: "error", message: "Invalid JSON format" }));
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

console.log("WebSocket server is running");
