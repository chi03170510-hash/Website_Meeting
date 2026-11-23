import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class SignalingHandler {
    private static class Client {
        final WebSocketConnection ws;
        volatile String room, username;   // room != null  -> đã ở trong phòng
        volatile String pendingRoom;      // != null        -> đang chờ duyệt
        Client(WebSocketConnection ws) { this.ws = ws; }
    }

    private final RoomManager rooms;
    private final Map<String, Client> clients = new ConcurrentHashMap<>();
    private final Object lock = new Object();

    public SignalingHandler(RoomManager rooms) { this.rooms = rooms; }

    public void handle(WebSocketConnection ws) {
        String id = UUID.randomUUID().toString();
        Client client = new Client(ws);
        clients.put(id, client);
        try {
            ws.sendText(Json.stringify(Map.of("type", "connected", "client_id", id)));
            while (true) {
                WebSocketConnection.Frame frame = ws.readFrame();
                if (frame.opcode() == WebSocketConnection.CLOSE) break;
                if (frame.opcode() == WebSocketConnection.PING) { ws.sendPong(frame.payload()); continue; }
                if (frame.opcode() != WebSocketConnection.TEXT) continue;
                Map<String,Object> message = Json.object(new String(frame.payload(), StandardCharsets.UTF_8));
                handleMessage(id, client, message);
            }
        } catch (Exception e) {
            System.out.println("Signaling client " + id + " disconnected: " + e.getMessage());
        } finally {
            leave(id, client);
            clients.remove(id);
            try { ws.sendClose(); } catch (IOException ignored) {}
        }
    }

    private void handleMessage(String id, Client c, Map<String,Object> m) throws IOException {
        String type = String.valueOf(m.getOrDefault("type", ""));
        switch (type) {
            case "join" -> join(id, c, m);
            case "leave" -> leave(id, c);
            case "chat" -> chat(id, c, m);
            case "approve" -> decide(id, c, m, true);  
            case "reject" -> decide(id, c, m, false);   
            case "kick" -> kick(id, c, m);             
            case "ping" -> { }                          
            default -> System.out.println("Unknown signaling message: " + type);
        }
    }

    private void join(String id, Client c, Map<String,Object> m) throws IOException {
        String room = String.valueOf(m.getOrDefault("room", ""));
        String username = String.valueOf(m.getOrDefault("username", "User-" + id.substring(0, 8)));
        String password = String.valueOf(m.getOrDefault("password", ""));
        if (room.isBlank()) return;
        if (username.length() > 40) username = username.substring(0, 40);
        if (password.length() > 64) password = password.substring(0, 64);

        synchronized (lock) {
            if (c.room != null || c.pendingRoom != null) leave(id, c);

            if (rooms.roomExists(room) && !rooms.checkPassword(room, password)) {
                send(c, msg("type", "join_error", "reason", "wrong_password"));
                return;
            }
            c.username = username;
            if (!rooms.roomExists(room)) {
                rooms.setPassword(room, password);
                enterRoom(id, c, room); 
            } else {
                c.pendingRoom = room;
                rooms.addPending(room, id, username);
                send(c, msg("type", "waiting", "room", room));
                sendJoinRequest(rooms.getHost(room), id, username);
            }
        }
    }

    private void enterRoom(String id, Client c, String room) throws IOException {
        c.pendingRoom = null;
        c.room = room;
        rooms.addClient(room, id, c.username);

        send(c, msg("type", "room_users",
                "users", rooms.getRoomUsers(room),
                "host_id", rooms.getHost(room)));
        broadcast(room, msg("type", "user_joined", "client_id", id, "username", c.username), id);
    }

    private void leave(String id, Client c) {
        synchronized (lock) {
            String pr = c.pendingRoom;
            if (pr != null) {
                c.pendingRoom = null;
                rooms.removePending(pr, id);
                Client host = clients.get(rooms.getHost(pr));
                if (host != null) trySend(host, msg("type", "join_cancelled", "client_id", id));
            }

            String room = c.room;
            if (room == null) return;
            String oldHost = rooms.getHost(room);
            rooms.removeClient(room, id);
            c.room = null;
            broadcast(room, msg("type", "user_left", "client_id", id, "username", c.username), null);

            String newHost = rooms.getHost(room);
            if (newHost == null) {
                for (String waitingId : rooms.clearPending(room).keySet()) {
                    Client w = clients.get(waitingId);
                    if (w != null) {
                        w.pendingRoom = null;
                        trySend(w, msg("type", "rejected", "reason", "room_closed"));
                    }
                }
            } else if (!newHost.equals(oldHost)) {
                broadcast(room, msg("type", "host_changed", "host_id", newHost), null);
                for (var e : rooms.getPending(room).entrySet())
                    sendJoinRequest(newHost, e.getKey(), e.getValue());
            }
        }
    }

    private void decide(String id, Client host, Map<String,Object> m, boolean approve) {
        String targetId = String.valueOf(m.getOrDefault("client_id", ""));
        synchronized (lock) {
            String room = host.room;
            if (room == null || !id.equals(rooms.getHost(room))) return;   
            String name = rooms.removePending(room, targetId);
            Client target = clients.get(targetId);
            if (name == null || target == null) return;
            try {
                if (approve) enterRoom(targetId, target, room);
                else {
                    target.pendingRoom = null;
                    send(target, msg("type", "rejected", "reason", "host_rejected"));
                }
            } catch (IOException e) {
                System.out.println("Cannot notify " + targetId);
            }
        }
    }

    private void kick(String id, Client host, Map<String,Object> m) {
        String targetId = String.valueOf(m.getOrDefault("client_id", ""));
        synchronized (lock) {
            String room = host.room;
            if (room == null || !id.equals(rooms.getHost(room)) || targetId.equals(id)) return;
            Client target = clients.get(targetId);
            if (target == null || !room.equals(target.room)) return;

            trySend(target, msg("type", "kicked"));
            rooms.removeClient(room, targetId);
            target.room = null;
            broadcast(room, msg("type", "user_left", "client_id", targetId,
                    "username", target.username, "reason", "kicked"), null);
        }
    }

    private void chat(String id, Client c, Map<String,Object> m) {
        if (c.room == null) return;
        String text = String.valueOf(m.getOrDefault("text", ""));
        if (text.isBlank()) return;
        if (text.length() > 2000) text = text.substring(0, 2000);
        Map<String,Object> msg = new LinkedHashMap<>();
        msg.put("type", "chat"); msg.put("client_id", id); msg.put("username", c.username);
        msg.put("text", text); msg.put("timestamp", Instant.now().toString());
        broadcast(c.room, msg, null);
    }

    private void sendJoinRequest(String hostId, String clientId, String username) {
        Client h = hostId == null ? null : clients.get(hostId);
        if (h != null) trySend(h, msg("type", "join_request", "client_id", clientId, "username", username));
    }

    private void broadcast(String room, Map<String,Object> message, String exclude) {
        for (String id : rooms.getClientsInRoom(room)) {
            Client c = clients.get(id);
            if (c != null && !id.equals(exclude)) {
                try { send(c, message); } catch (IOException e) { System.out.println("Cannot send to " + id); }
            }
        }
    }

    private void send(Client c, Map<String,Object> message) throws IOException {
        c.ws.sendText(Json.stringify(message));
    }

    private void trySend(Client c, Map<String,Object> message) {
        try { send(c, message); } catch (IOException e) { System.out.println("Cannot send " + message.get("type")); }
    }

    private static Map<String,Object> msg(Object... kv) {
        Map<String,Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }
}
