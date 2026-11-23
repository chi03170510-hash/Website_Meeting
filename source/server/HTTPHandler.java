import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

public class HTTPHandler {
    private final Path clientRoot;

    public HTTPHandler(Path clientRoot) throws IOException {
        this.clientRoot = clientRoot.toRealPath();
    }

    public void handle(OutputStream out, String method, String rawPath) throws IOException {
        if (!"GET".equals(method)) {
            response(out, 405, "Method Not Allowed", "Method Not Allowed".getBytes(StandardCharsets.UTF_8), "text/plain");
            return;
        }
        String path = rawPath.split("\\?", 2)[0];
        path = URLDecoder.decode(path, StandardCharsets.UTF_8);
        if (path.equals("/") || path.isBlank()) path = "/index.html";

        Path target = clientRoot.resolve(path.substring(1)).normalize();
        if (!target.startsWith(clientRoot)) {
            response(out, 403, "Forbidden", "Forbidden".getBytes(StandardCharsets.UTF_8), "text/plain");
            return;
        }
        if (!Files.isRegularFile(target)) {
            response(out, 404, "Not Found", "Not Found".getBytes(StandardCharsets.UTF_8), "text/plain");
            return;
        }
        Path real = target.toRealPath();
        if (!real.startsWith(clientRoot)) {
            response(out, 403, "Forbidden", "Forbidden".getBytes(StandardCharsets.UTF_8), "text/plain");
            return;
        }
        String type = mimeOf(real.getFileName().toString()); 
        if (type == null) type = Files.probeContentType(real);
        if (type == null) type = "application/octet-stream";
        if (type.startsWith("text/") || type.equals("application/javascript") || type.equals("application/json"))
            type += "; charset=UTF-8";
        response(out, 200, "OK", Files.readAllBytes(real), type);
    }

    private static String mimeOf(String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".html") || n.endsWith(".htm")) return "text/html";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".js") || n.endsWith(".mjs")) return "text/javascript";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".ico")) return "image/x-icon";
        return null;
    }

    private void response(OutputStream out, int code, String status, byte[] body, String contentType) throws IOException {
        String header = "HTTP/1.1 " + code + " " + status + "\r\n"
                + "Content-Type: " + contentType + "\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Connection: close\r\n\r\n";
        out.write(header.getBytes(StandardCharsets.UTF_8));
        out.write(body);
        out.flush();
    }
}
