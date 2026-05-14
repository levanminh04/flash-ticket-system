package com.flashticket.discovery.chat.service;

import com.flashticket.discovery.chat.dto.*;
import com.flashticket.discovery.mood.MoodDetector;
import com.flashticket.discovery.mood.model.UserMood;
import com.flashticket.discovery.rag.strategy.AdaptiveRagRouter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final DiscoveryAssistant assistant;
    private final MoodDetector moodDetector;

    public ChatResponse processMessage(String userId, String sessionId,
                                        String message, String jwtToken,
                                        String userName, String userEmail) {
        // 1. Detect mood
        UserMood mood = moodDetector.detect(message);
        log.info("[Chat] User={}, Mood={}, Message='{}'", userId, mood, message);

        // 2. Set JWT context for tools (BookingTool, PaymentTool)
        JwtContextHolder.set(jwtToken);

        try {
            // 3. Call assistant (ReAct loop — RAG + tools are automatic via AiServices)
            // AdaptiveRagRouter đã được gọi ngầm bên trong chat() thông qua sự điều phối của langchain4j
            String response = assistant.chat(sessionId, userName, userEmail, message);

            // 4. Get actual RAG strategy used (set by AdaptiveRagRouter during retrieve)
            String ragStrategy = AdaptiveRagRouter.getLastStrategy();

            return new ChatResponse(
                    sessionId, response, mood.name(),
                    ragStrategy != null ? ragStrategy : "SIMPLE"
            );
        } catch (Exception e) {
            log.error("[Chat] Error processing message for user={}", userId, e);
            return new ChatResponse(
                    sessionId,
                    "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại.",
                    mood.name(),
                    "ERROR"
            );
        } finally {
            JwtContextHolder.clear();
            AdaptiveRagRouter.clearLastStrategy();
        }
    }
}
