package com.flashticket.discovery.chat.service;

/**
     Khi chat với AI, AI chỉ nhận văn bản (text). Nếu AI quyết định gọi một Tool (ví dụ: BookingTool để đặt vé), cái Tool đó cần phải biết mày là ai để gọi sang hệ thống lõi (core-service).
        - Nếu đưa Token vào trong câu lệnh cho AI, AI sẽ bị loãng thông tin và tốn Token.
        - Nếu không đưa Token vào, lỗi 401 Unauthorized.
 *   IMPORTANT: Always clear in finally block to prevent ThreadLocal leak.
 */
public final class JwtContextHolder {
    // new ThreadLocal<>() được sử dụng để tạo ra một biến cục bộ của luồng (Thread-Local Variable), tức là chỉ thuộc phạm vi của luồng hiện tại, luồng khác hoàn toàn không sửa được.
    // biến HOLDER là static nhưng lại giữ giá trị khác nhau cho mỗi người dùng. Tại sao? => VÌ bản chất bên trong nó có 1 MAP
    // dù hàm get() ta không truyền tham số nào vào nhưng mà java tự biết gọi Thread.currentThread(); để lấy ra cái JWT của thread đó.
    private static final ThreadLocal<String> HOLDER = new ThreadLocal<>();

    public static void set(String jwt) { HOLDER.set(jwt); }
    public static String get() { return HOLDER.get(); }
    public static void clear() { HOLDER.remove(); }

    private JwtContextHolder() {}
    // private Bắt buộc không thể tạo đối tượng, Ngăn chặn việc khởi tạo đối tượng vô nghĩa
    // JwtContextHolder là Utility Class. Tất cả các phương thức (set, get, clear) đều là static => nên chỉ việc gọi method, không cần new JwtContextHolder().
    // static có nghĩa là biến đó thuộc về Lớp, chứ không thuộc về Đối tượng.
    // Nếu viết JwtContextHolder h = new JwtContextHolder(); h.set(token);,
    // người đọc code sẽ tưởng token đó chỉ nằm trong cái h này thôi. Nhưng thực tế vì nó là static, nó ảnh hưởng đến toàn bộ hệ thống. Việc cấm new giúp loại bỏ sự hiểu lầm này.


}
