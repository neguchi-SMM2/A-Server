const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 10000;

// 保存するデータ
let storedData = [];

// HTTPサーバーの作成（Render用）
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// WebSocketサーバーの作成
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
        try {
            const { request_type, username, data } = JSON.parse(message);

            switch (request_type) {
                case "save":
                    storedData.push({ username, data });
                    ws.send(JSON.stringify({ status: "success", message: "Data saved" }));
                    break;

                case "get":
                    ws.send(JSON.stringify({ status: "success", data: storedData }));
                    break;

                case "delete_all":
                    storedData = [];
                    ws.send(JSON.stringify({ status: "success", message: "All data deleted" }));
                    break;

                case "delete_n":
                    const index = parseInt(data, 10);
                    if (index >= 0 && index < storedData.length) {
                        storedData.splice(index, 1);
                        ws.send(JSON.stringify({ status: "success", message: `Deleted data at index ${index}` }));
                    } else {
                        ws.send(JSON.stringify({ status: "error", message: "Invalid index" }));
                    }
                    break;

                case "delete_user":
                    storedData = storedData.filter(entry => entry.username !== username);
                    ws.send(JSON.stringify({ status: "success", message: `Deleted all data from user: ${username}` }));
                    break;

                default:
                    ws.send(JSON.stringify({ status: "error", message: "Invalid request type" }));
            }
        } catch (err) {
            ws.send(JSON.stringify({ status: "error", message: "Invalid JSON format" }));
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});
