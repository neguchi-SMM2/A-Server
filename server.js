const fs = require("fs");
const crypto = require("crypto");
const WebSocket = require("ws");

// 🔑 暗号化用の秘密鍵（32バイト = 256ビット）
const SECRET_KEY = "ApUcaTynMjy5iTsZQVgHCeRCnGbn2uwK"; // 必ず32文字
const DATA_FILE = "data.json";

// 🔄 データの保存先（ルームごと）
let storage = {};

// 📂 ファイルが存在する場合は読み込む
if (fs.existsSync(DATA_FILE)) {
    try {
        const encryptedData = fs.readFileSync(DATA_FILE, "utf8");
        storage = decryptData(encryptedData);
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

// 📡 WebSocket サーバーを起動
const wss = new WebSocket.Server({ port: 10000 });

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        try {
            const { request_type, username, data, room, order, limit } = JSON.parse(message);

            if (!room) {
                return ws.send(JSON.stringify({ status: "error", message: "Room is required" }));
            }

            // ルームがない場合は初期化
            if (!storage[room]) {
                storage[room] = [];
            }

            switch (request_type) {
                case "save":
                    storage[room].push({ username, data, timestamp: Date.now() });
                    saveData();
                    ws.send(JSON.stringify({ status: "success", message: "Data saved" }));
                    break;

                case "delete_all":
                    storage[room] = [];
                    saveData();
                    ws.send(JSON.stringify({ status: "success", message: "All data deleted" }));
                    break;

                case "delete_nth":
                    if (typeof data === "number" && data >= 0 && data < storage[room].length) {
                        storage[room].splice(data, 1);
                        saveData();
                        ws.send(JSON.stringify({ status: "success", message: `Deleted index ${data}` }));
                    } else {
                        ws.send(JSON.stringify({ status: "error", message: "Invalid index" }));
                    }
                    break;

                case "delete_user":
                    storage[room] = storage[room].filter(entry => entry.username !== username);
                    saveData();
                    ws.send(JSON.stringify({ status: "success", message: `Deleted data from ${username}` }));
                    break;

                case "get_nth":
                    if (typeof data === "number" && data >= 0 && data < storage[room].length) {
                        ws.send(JSON.stringify({ status: "success", data: storage[room][data] }));
                    } else {
                        ws.send(JSON.stringify({ status: "error", message: "Invalid index" }));
                    }
                    break;

                case "get_user":
                    const userData = storage[room].filter(entry => entry.username === username);
                    ws.send(JSON.stringify({ status: "success", data: userData }));
                    break;

                case "get_all":
                    let sortedData = [...storage[room]];
                    if (order === "desc") sortedData.reverse();
                    const limitedData = limit ? sortedData.slice(0, limit) : sortedData;
                    ws.send(JSON.stringify({ status: "success", data: limitedData }));
                    break;

                default:
                    ws.send(JSON.stringify({ status: "error", message: "Invalid request type" }));
            }
        } catch (err) {
            ws.send(JSON.stringify({ status: "error", message: "Invalid JSON format" }));
        }
    });
});

// 📌 AES-256-CBC 暗号化関数
function encryptData(data) {
    const iv = crypto.randomBytes(16); // 16バイトのIVを生成
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(SECRET_KEY), iv);
    let encrypted = cipher.update(JSON.stringify(data), "utf8", "base64");
    encrypted += cipher.final("base64");
    return iv.toString("base64") + ":" + encrypted; // IVと暗号化データを結合
}

// 🔓 AES-256-CBC 復号化関数
function decryptData(encryptedData) {
    try {
        if (!encryptedData || !encryptedData.includes(":")) {
            console.warn("Warning: Invalid encrypted data format.");
            return {}; // データが不正なら空のオブジェクトを返す
        }

        const [ivBase64, encryptedText] = encryptedData.split(":");
        if (!ivBase64 || !encryptedText) {
            console.warn("Warning: Missing IV or encrypted text.");
            return {}; // 不正なデータなら空にする
        }

        const iv = Buffer.from(ivBase64, "base64");
        if (iv.length !== 16) {
            throw new Error("Invalid initialization vector length");
        }

        const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(SECRET_KEY), iv);
        let decrypted = decipher.update(encryptedText, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return JSON.parse(decrypted);
    } catch (err) {
        console.error("Error decrypting data:", err);
        return {}; // 復号に失敗したら空のデータを返す
    }
}

// 💾 データを暗号化して保存
function saveData() {
    try {
        const encryptedData = encryptData(storage);
        fs.writeFileSync(DATA_FILE, encryptedData, "utf8");
    } catch (err) {
        console.error("Error saving data:", err);
    }
}

console.log("WebSocket server is running");
