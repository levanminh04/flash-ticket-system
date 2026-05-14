package com.flashticket.discovery.mood.model;

/**
 * 5 trạng thái cảm xúc — ảnh hưởng retrieval bias và response tone.
 */
public enum UserMood {
    EXCITED("Nhiệt tình, nhanh, dùng emoji 🎉. Ưu tiên kết quả chính xác."),
    STRESSED("Bình tĩnh, rõ ràng, ngắn gọn. Ưu tiên sự kiện sắp diễn ra gần."),
    SAD("Đồng cảm, nhẹ nhàng, gợi ý tích cực. Ưu tiên sự kiện vui nhộn, giá rẻ."),
    RELAXED("Thoải mái, gợi ý đa dạng. Ưu tiên trải nghiệm mới lạ."),
    NEUTRAL("Chuyên nghiệp, đầy đủ thông tin. Không bias đặc biệt.");

    private final String instruction;
    UserMood(String instruction) { this.instruction = instruction; }
    public String getInstruction() { return instruction; }
}
