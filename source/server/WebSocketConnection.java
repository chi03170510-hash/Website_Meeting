import java.io.*;
import java.nio.charset.StandardCharsets;

public class WebSocketConnection {
    public static final int TEXT = 1, BINARY = 2, CLOSE = 8, PING = 9, PONG = 10;
    public record Frame(int opcode, byte[] payload) {}

    private final InputStream in;
    private final OutputStream out;
    private final Object writeLock = new Object();

    public WebSocketConnection(InputStream in, OutputStream out) {
        this.in = in; this.out = out;
    }

    private int readByte() throws IOException {
        int b = in.read();
        if (b < 0) throw new EOFException("WebSocket connection closed");
        return b;
    }

    public Frame readFrame() throws IOException {
        int b1 = readByte(), b2 = readByte();
        boolean masked = (b2 & 0x80) != 0;
        int opcode = b1 & 0x0F;
        long length = b2 & 0x7F;
        if (length == 126) length = ((long)readByte() << 8) | readByte();
        else if (length == 127) {
            length = 0;
            for (int i = 0; i < 8; i++) length = (length << 8) | readByte();
        }
        if (length > 16 * 1024 * 1024) throw new IOException("Frame quá lớn");
        byte[] mask = masked ? in.readNBytes(4) : new byte[0];
        if (masked && mask.length != 4) throw new EOFException();
        byte[] payload = in.readNBytes((int)length);
        if (payload.length != (int)length) throw new EOFException();
        if (masked) for (int i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
        return new Frame(opcode, payload);
    }

    public void sendText(String text) throws IOException {
        sendFrame(TEXT, text.getBytes(StandardCharsets.UTF_8));
    }

    public void sendBinary(byte[] data) throws IOException {
        sendFrame(BINARY, data);
    }

    public void sendPong(byte[] data) throws IOException {
        sendFrame(PONG, data);
    }

    public void sendClose() throws IOException {
        sendFrame(CLOSE, new byte[0]);
    }

    private void sendFrame(int opcode, byte[] payload) throws IOException {
        synchronized (writeLock) {
            out.write(0x80 | opcode);
            int len = payload.length;
            if (len < 126) out.write(len);
            else if (len <= 65535) {
                out.write(126); out.write((len >>> 8) & 0xff); out.write(len & 0xff);
            } else {
                out.write(127);
                for (int i = 7; i >= 0; i--) out.write((int)(((long)len >>> (8 * i)) & 0xff));
            }
            out.write(payload);
            out.flush();
        }
    }
    
    
}
