import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

public class RoomManager {
    public record RoomUser(String client_id, String username, String joined_at) {}
    private final Map<String, LinkedHashMap<String, RoomUser>> rooms = new HashMap<>();
    private final Map<String, String> hosts = new HashMap<>();
    private final Map<String, String> passwords = new HashMap<>();
    private final Map<String, LinkedHashMap<String, String>> pending = new HashMap<>();

    public synchronized void addClient(String roomId, String clientId, String username) {
        rooms.computeIfAbsent(roomId, k -> new LinkedHashMap<>())
             .put(clientId, new RoomUser(clientId, username, Instant.now().toString()));
        hosts.putIfAbsent(roomId, clientId); 
    }

    public synchronized void removeClient(String roomId, String clientId) {
        LinkedHashMap<String, RoomUser> room = rooms.get(roomId);
        if (room == null) return;
        room.remove(clientId);
        if (room.isEmpty()) {
            rooms.remove(roomId);
            hosts.remove(roomId);
            passwords.remove(roomId);
        } else if (clientId.equals(hosts.get(roomId))) {
            hosts.put(roomId, room.keySet().iterator().next());
        }
    }

    public synchronized List<String> getClientsInRoom(String roomId) {
        var room = rooms.get(roomId);
        return room == null ? new ArrayList<>() : new ArrayList<>(room.keySet());
    }

    public synchronized List<Map<String,Object>> getRoomUsers(String roomId) {
        List<Map<String,Object>> result = new ArrayList<>();
        var room = rooms.get(roomId);
        if (room != null) for (RoomUser u : room.values()) {
            Map<String,Object> item = new LinkedHashMap<>();
            item.put("client_id", u.client_id());
            item.put("username", u.username());
            item.put("joined_at", u.joined_at());
            result.add(item);
        }
        return result;
    }

    public synchronized boolean roomExists(String roomId) {
        return rooms.containsKey(roomId);
    }

    public synchronized void setPassword(String roomId, String password) {
        if (password == null || password.isEmpty()) passwords.remove(roomId);
        else passwords.put(roomId, password);
    }

    public synchronized boolean checkPassword(String roomId, String password) {
        String real = passwords.get(roomId);
        if (real == null) return true;
        return MessageDigest.isEqual(real.getBytes(StandardCharsets.UTF_8),
                password.getBytes(StandardCharsets.UTF_8));
    }

    public synchronized boolean isInRoom(String roomId, String clientId) {
        var room = rooms.get(roomId);
        return room != null && room.containsKey(clientId);
    }

    public synchronized String getHost(String roomId) {
        return hosts.get(roomId);
    }

    public synchronized void addPending(String roomId, String clientId, String username) {
        pending.computeIfAbsent(roomId, k -> new LinkedHashMap<>()).put(clientId, username);
    }

    public synchronized String removePending(String roomId, String clientId) {
        var p = pending.get(roomId);
        if (p == null) return null;
        String name = p.remove(clientId);
        if (p.isEmpty()) pending.remove(roomId);
        return name;
    }

    public synchronized Map<String, String> getPending(String roomId) {
        var p = pending.get(roomId);
        return p == null ? new LinkedHashMap<>() : new LinkedHashMap<>(p);
    }

    public synchronized Map<String, String> clearPending(String roomId) {
        var p = pending.remove(roomId);
        return p == null ? new LinkedHashMap<>() : p;
    }
}
