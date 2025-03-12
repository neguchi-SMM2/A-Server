const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

// 🔹 Supabase 接続情報
const SUPABASE_URL = "https://mnhqwwrdyoqgawklcrjv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaHF3d3JkeW9xZ2F3a2xjcmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NjY0MTIsImV4cCI6MjA1NzM0MjQxMn0.HtXQpo-Vv66Qti09jyx6A9gNiDCvo2bYFWta0qEDQEc";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 📡 WebSocketサーバーを作成
const wss = new WebSocket.Server({ port: 10000 });

wss.on("connection", (ws) => {
    ws.on("message", async (message) => {
        try {
            const { request_type, username, data, room, order, limit } = JSON.parse(message);

            switch (request_type) {
                case "save":
                    // 🔹 データを Supabase に保存
                    const { error: saveError } = await supabase
                        .from("messages")
                        .insert([{ room, username, data, timestamp: Date.now() }]);

                    if (saveError) throw saveError;
                    ws.send(JSON.stringify({ status: "success", message: "Data saved" }));
                    break;

                case "get_all":
                    // 🔹 Supabase からデータ取得 + 並び替え
                    let { data: messages, error: getError } = await supabase
                        .from("messages")
                        .select("*")
                        .eq("room", room)
                        .order("data", { ascending: order === "asc" })
                        .limit(limit || 100);

                    if (getError) throw getError;
                    ws.send(JSON.stringify({ status: "success", data: messages }));
                    break;

                case "delete_all":
                    // 🔹 ルーム内のデータを全削除
                    const { error: deleteAllError } = await supabase
                        .from("messages")
                        .delete()
                        .eq("room", room);

                    if (deleteAllError) throw deleteAllError;
                    ws.send(JSON.stringify({ status: "success", message: "All data deleted" }));
                    break;

                case "delete_nth":
                    // 🔹 n番目のデータを削除
                    let { data: messagesForDelete, error: getDeleteError } = await supabase
                        .from("messages")
                        .select("*")
                        .eq("room", room)
                        .order("timestamp", { ascending: true })
                        .limit(1)
                        .offset(data); // n番目のデータを取得

                    if (getDeleteError) throw getDeleteError;
                    if (!messagesForDelete.length) {
                        ws.send(JSON.stringify({ status: "error", message: "Invalid index" }));
                        return;
                    }

                    const { error: deleteNthError } = await supabase
                        .from("messages")
                        .delete()
                        .eq("id", messagesForDelete[0].id);

                    if (deleteNthError) throw deleteNthError;
                    ws.send(JSON.stringify({ status: "success", message: `Deleted index ${data}` }));
                    break;

                case "delete_user":
                    // 🔹 特定のユーザーのデータを削除
                    const { error: deleteUserError } = await supabase
                        .from("messages")
                        .delete()
                        .eq("room", room)
                        .eq("username", username);

                    if (deleteUserError) throw deleteUserError;
                    ws.send(JSON.stringify({ status: "success", message: `Deleted data from ${username}` }));
                    break;

                default:
                    ws.send(JSON.stringify({ status: "error", message: "Invalid request type" }));
            }
        } catch (err) {
            ws.send(JSON.stringify({ status: "error", message: err.message }));
        }
    });
});

console.log("WebSocket server is running");