//package com.flashticket.discovery.mood;
//
//import com.flashticket.discovery.mood.model.UserMood;
//import org.springframework.stereotype.Component;
//
///**
// * Inject mood instruction vào system prompt trước khi gọi LLM.
// * Không thay đổi user message — chỉ thêm context cho LLM.
// */
//@Component
//public class MoodAwarePromptEnhancer {
//
//    /**
//     * Tạo mood-aware system suffix.
//     * Được append vào system prompt của DiscoveryAssistant.
//     */
//    public String enhance(UserMood mood) {
//        return String.format("""
//
//            HƯỚNG DẪN TONE HIỆN TẠI (mood: %s):
//            %s
//            """, mood.name(), mood.getInstruction());
//    }
//
//    /**
//     * Điều chỉnh retrieval query dựa trên mood.
//     * Thêm bias keywords vào query trước khi search.
//     */
//    public String adjustQuery(String originalQuery, UserMood mood) {
//        return switch (mood) {
//            case SAD -> originalQuery + " vui nhộn giải trí giá rẻ";
//            case STRESSED -> originalQuery + " gần đây sắp diễn ra";
//            case EXCITED -> originalQuery; // Không bias — user đã biết muốn gì
//            case RELAXED -> originalQuery + " trải nghiệm mới độc đáo";
//            case NEUTRAL -> originalQuery;
//        };
//    }
//}
