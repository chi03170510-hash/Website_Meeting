import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class MediaHandler {
    private record MediaClient(WebSocketConnection ws, String room) {}
    private final RoomManager rooms;
    private final Map<String, MediaClient> mediaClients = new ConcurrentHashMap<>();

    public MediaHandler(RoomManager rooms) { this.rooms = rooms; }

    public void handle(WebSocketConnection ws) {
        try {
            while (true) {
                WebSocketConnection.Frame frame = ws.readFrame();
                if (frame.opcode() == WebSocketConnection.CLOSE) break;
                if (frame.opcode() == WebSocketConnection.PING) { ws.sendPong(frame.payload()); continue; }
                if (frame.opcode() != WebSocketConnection.BINARY) continue;
                handlePacket(frame.payload(), ws);
            }
        } catch (Exception e) {
            System.out.println("Media client disconnected: " + e.getMessage());
        } finally {
            mediaClients.entrySet().removeIf(e -> e.getValue().ws() == ws);
            try { ws.sendClose(); } catch (IOException ignored) {}
        }
    }

    private void handlePacket(byte[] data, WebSocketConnection sender) throws IOException {
        if (data.length < 3) return;
        int offset = 0;
        int packetType = data[offset++] & 0xff;
        int clientIdLen = data[offset++] & 0xff;
        if (offset + clientIdLen + 1 > data.length) return;
        String clientId = new String(data, offset, clientIdLen, StandardCharsets.UTF_8);
        offset += clientIdLen;
        int roomLen = data[offset++] & 0xff;
        if (offset + roomLen > data.length) return;
        String roomId = new String(data, offset, roomLen, StandardCharsets.UTF_8);
        offset += roomLen;
        if (packetType != 1 && packetType != 2) return;
        if (!rooms.isInRoom(roomId, clientId)) return;

        mediaClients.put(clientId, new MediaClient(sender, roomId));
        byte[] senderBytes = clientId.getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream packet = new ByteArrayOutputStream();
        packet.write(packetType);
        packet.write(senderBytes.length);
        packet.write(senderBytes);
        packet.write(data, offset, data.length - offset);
        byte[] outgoing = packet.toByteArray();

        for (String receiverId : rooms.getClientsInRoom(roomId)) {
            if (receiverId.equals(clientId)) continue;
            MediaClient receiver = mediaClients.get(receiverId);
            if (receiver != null && receiver.room().equals(roomId)) {
                try { receiver.ws().sendBinary(outgoing); }
                catch (IOException e) { System.out.println("Cannot forward media to " + receiverId); }
            }
        }
    }
    
}
