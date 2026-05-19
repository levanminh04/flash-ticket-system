package com.flashticket.discovery.mood;

import com.flashticket.discovery.mood.model.UserMood;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.input.PromptTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Phát hiện mood từ message dùng LLM classification.
 * Lightweight: 1 LLM call nhanh với gemini-2.0-flash.
 * Fallback: NEUTRAL nếu detect fail.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MoodDetector {

    private final ChatModel chatModel;

    private static final String DETECT_PROMPT = """
        Phân loại cảm xúc của tin nhắn sau. Trả về ĐÚNG 1 từ:
        EXCITED — Hào hứng, phấn khích, háo hức
        STRESSED — Lo lắng, gấp gáp, áp lực thời gian
        SAD — Buồn, chán, thất vọng, cô đơn
        RELAXED — Thư giãn, thoải mái, không vội
        NEUTRAL — Trung tính, hỏi thông tin bình thường

        Tin nhắn: {{message}}
        """;

    public UserMood detect(String message) {
        try {
            var userMessage = PromptTemplate.from(DETECT_PROMPT)
                    .apply(Map.of("message", message))
                    .toUserMessage();
            String result = chatModel.chat(userMessage).aiMessage().text().trim().toUpperCase();
            // ChatModel.chat() gọi thẳng đến model để hỏi, không có ngữ cảnh trước đó

            return switch (result) {
                case "EXCITED" -> UserMood.EXCITED;
                case "STRESSED" -> UserMood.STRESSED;
                case "SAD" -> UserMood.SAD;
                case "RELAXED" -> UserMood.RELAXED;
                default -> UserMood.NEUTRAL;
            };
        } catch (Exception e) {
            log.warn("[MoodDetector] Failed, defaulting NEUTRAL: {}", e.getMessage());
            return UserMood.NEUTRAL;
        }
    }
}
