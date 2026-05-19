
/**
 * ThreadLocal holder để truyền Metadata Filter ngầm từ tầng Service xuống tầng Retriever.
 * 
 * MỤC ĐÍCH:
 * 1. Giải quyết hạn chế của interface ContentRetriever (chỉ nhận vào Query là String).
 * 2. Cho phép truyền các bộ lọc cứng như: city, status, dateRange... mà không cần 
 *    phải "nhồi" chúng vào câu query của người dùng (làm loãng vector).
 * 3. Đảm bảo tính nhất quán của dữ liệu lọc xuyên suốt một yêu cầu (Request).
 * 
 * CÁCH DÙNG:
 * - ChatService/AdaptiveRagRouter: Gọi .setFilter("city", "Hanoi")
 * - EventContentRetriever: Gọi .getFilters() để build MetadataFilter cho PGVector.
 * 
 * LƯU Ý: Phải gọi .clear() trong block finally để tránh rò rỉ bộ nhớ (Memory Leak).
 */