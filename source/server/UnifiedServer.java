import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.concurrent.*;

public class UnifiedServer {
    private static final String WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    private final String host;
    private final int port;
    private final RoomManager roomManager = new RoomManager();
    private final HTTPHandler httpHandler;
    private final SignalingHandler signalingHandler = new SignalingHandler(roomManager);
    private final MediaHandler mediaHandler = new MediaHandler(roomManager);
    private final ExecutorService pool = Executors.newCachedThreadPool();

    public UnifiedServer(String host, int port, Path clientDir) throws IOException {
        this.host = host; this.port = port;
        this.httpHandler = new HTTPHandler(clientDir);
    }

    public void start() throws IOException {
        try (ServerSocket server = new ServerSocket()) {
            server.bind(new InetSocketAddress(host, port));
            System.out.println("Java server running at http://" + host + ":" + port);
            while (!server.isClosed()) {
                Socket socket = server.accept();
                pool.submit(() -> handleClient(socket));
            }
        } finally {
            pool.shutdown();
        }
    }

    private void handleClient(Socket socket) {
        try (socket) {
            socket.setSoTimeout(0);
            InputStream in = new BufferedInputStream(socket.getInputStream());
            OutputStream out = new BufferedOutputStream(socket.getOutputStream());

            String requestLine = readLine(in);
            if (requestLine == null || requestLine.isBlank()) return;
            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;

            String method = parts[0], path = parts[1];
            String upgrade = "";
            String websocketKey = "";
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon > 0) {
                    String key = line.substring(0, colon).trim().toLowerCase();
                    String value = line.substring(colon + 1).trim();
                    if (key.equals("upgrade")) upgrade = value.toLowerCase();
                    if (key.equals("sec-websocket-key")) websocketKey = value;
                }
            }

            if ("websocket".equals(upgrade)) {
                if (websocketKey.isBlank() || !(path.equals("/signaling") || path.equals("/media"))) {
                    writeHttpError(out, 400, "Bad Request"); return;
                }
                handshake(out, websocketKey);
                WebSocketConnection ws = new WebSocketConnection(in, out);
                if (path.equals("/signaling")) signalingHandler.handle(ws);
                else mediaHandler.handle(ws);
            } else {
                httpHandler.handle(out, method, path);
            }
        } catch (Exception e) {
            System.out.println("Connection error: " + e.getMessage());
        }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int previous = -1, current;
        while ((current = in.read()) != -1) {
            if (previous == '\r' && current == '\n') {
                byte[] bytes = b.toByteArray();
                return new String(bytes, 0, Math.max(0, bytes.length - 1), StandardCharsets.US_ASCII);
            }
            b.write(current); previous = current;
            if (b.size() > 16_384) throw new IOException("HTTP header quá dài");
        }
        return b.size() == 0 ? null : b.toString(StandardCharsets.US_ASCII);
    }

    private static void handshake(OutputStream out, String key) throws Exception {
        String accept = Base64.getEncoder().encodeToString(
                MessageDigest.getInstance("SHA-1").digest((key + WS_GUID).getBytes(StandardCharsets.US_ASCII)));
        String response = "HTTP/1.1 101 Switching Protocols\r\n"
                + "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                + "Sec-WebSocket-Accept: " + accept + "\r\n\r\n";
        out.write(response.getBytes(StandardCharsets.US_ASCII));
        out.flush();
    }

    private static void writeHttpError(OutputStream out, int code, String status) throws IOException {
        byte[] body = status.getBytes(StandardCharsets.UTF_8);
        out.write(("HTTP/1.1 " + code + " " + status + "\r\nContent-Type: text/plain\r\n"
                + "Content-Length: " + body.length + "\r\nConnection: close\r\n\r\n")
                .getBytes(StandardCharsets.US_ASCII));
        out.write(body); out.flush();
    }

    public static void main(String[] args) throws Exception {
        String host = args.length > 0 ? args[0] : "0.0.0.0";
        int port = args.length > 1 ? Integer.parseInt(args[1]) : 8080;
        Path clientDir = args.length > 2 ? Paths.get(args[2]) : Paths.get("source", "client");
        new UnifiedServer(host, port, clientDir).start();
    }
    
}
