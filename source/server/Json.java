import java.util.*;

public final class Json {
    private Json() {}

    public static Object parse(String text) {
        Parser p = new Parser(text);
        Object value = p.value();
        p.ws();
        if (p.pos != text.length()) throw new IllegalArgumentException("JSON thừa dữ liệu");
        return value;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> object(String text) {
        Object value = parse(text);
        if (!(value instanceof Map)) throw new IllegalArgumentException("JSON phải là object");
        return (Map<String, Object>) value;
    }

    public static String stringify(Object value) {
        if (value == null) return "null";
        if (value instanceof String s) return quote(s);
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?> map) {
            StringJoiner j = new StringJoiner(",", "{", "}");
            for (var e : map.entrySet()) j.add(quote(String.valueOf(e.getKey())) + ":" + stringify(e.getValue()));
            return j.toString();
        }
        if (value instanceof Iterable<?> values) {
            StringJoiner j = new StringJoiner(",", "[", "]");
            for (Object v : values) j.add(stringify(v));
            return j.toString();
        }
        return quote(value.toString());
    }

    private static String quote(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\b' -> b.append("\\b");
                case '\f' -> b.append("\\f");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> {
                    if (c < 0x20) b.append(String.format("\\u%04x", (int)c));
                    else b.append(c);
                }
            }
        }
        return b.append('"').toString();
    }

    private static final class Parser {
        final String s; int pos = 0;
        Parser(String s) { this.s = Objects.requireNonNull(s); }
        void ws() { while (pos < s.length() && Character.isWhitespace(s.charAt(pos))) pos++; }
        char take() { if (pos >= s.length()) throw new IllegalArgumentException("JSON không đầy đủ"); return s.charAt(pos++); }
        boolean eat(char c) { ws(); if (pos < s.length() && s.charAt(pos) == c) { pos++; return true; } return false; }

        Object value() {
            ws();
            if (pos >= s.length()) throw new IllegalArgumentException("JSON rỗng");
            char c = s.charAt(pos);
            if (c == '{') return obj();
            if (c == '[') return arr();
            if (c == '"') return str();
            if (s.startsWith("true", pos)) { pos += 4; return true; }
            if (s.startsWith("false", pos)) { pos += 5; return false; }
            if (s.startsWith("null", pos)) { pos += 4; return null; }
            return number();
        }

        Map<String,Object> obj() {
            take(); Map<String,Object> m = new LinkedHashMap<>(); ws();
            if (eat('}')) return m;
            do {
                ws(); if (take() != '"') throw new IllegalArgumentException("Tên thuộc tính phải là chuỗi");
                pos--; String k = str();
                if (!eat(':')) throw new IllegalArgumentException("Thiếu dấu :");
                m.put(k, value());
            } while (eat(','));
            if (!eat('}')) throw new IllegalArgumentException("Thiếu }");
            return m;
        }

        List<Object> arr() {
            take(); List<Object> a = new ArrayList<>(); ws();
            if (eat(']')) return a;
            do { a.add(value()); } while (eat(','));
            if (!eat(']')) throw new IllegalArgumentException("Thiếu ]");
            return a;
        }

        String str() {
            if (take() != '"') throw new IllegalArgumentException("Thiếu dấu nháy");
            StringBuilder b = new StringBuilder();
            while (pos < s.length()) {
                char c = take();
                if (c == '"') return b.toString();
                if (c == '\\') {
                    char e = take();
                    switch (e) {
                        case '"', '\\', '/' -> b.append(e);
                        case 'b' -> b.append('\b');
                        case 'f' -> b.append('\f');
                        case 'n' -> b.append('\n');
                        case 'r' -> b.append('\r');
                        case 't' -> b.append('\t');
                        case 'u' -> {
                            if (pos + 4 > s.length()) throw new IllegalArgumentException("Unicode escape lỗi");
                            b.append((char)Integer.parseInt(s.substring(pos, pos + 4), 16)); pos += 4;
                        }
                        default -> throw new IllegalArgumentException("Escape không hợp lệ");
                    }
                } else b.append(c);
            }
            throw new IllegalArgumentException("Chuỗi chưa đóng");
        }

        Number number() {
            int start = pos;
            if (pos < s.length() && s.charAt(pos) == '-') pos++;
            while (pos < s.length() && Character.isDigit(s.charAt(pos))) pos++;
            if (pos < s.length() && s.charAt(pos) == '.') {
                pos++; while (pos < s.length() && Character.isDigit(s.charAt(pos))) pos++;
            }
            if (pos < s.length() && (s.charAt(pos) == 'e' || s.charAt(pos) == 'E')) {
                pos++; if (pos < s.length() && (s.charAt(pos) == '+' || s.charAt(pos) == '-')) pos++;
                while (pos < s.length() && Character.isDigit(s.charAt(pos))) pos++;
            }
            String n = s.substring(start, pos);
            if (n.isEmpty() || n.equals("-")) throw new IllegalArgumentException("Số không hợp lệ");
            return n.contains(".") || n.contains("e") || n.contains("E") ? Double.parseDouble(n) : Long.parseLong(n);
        }
    
    }
}
