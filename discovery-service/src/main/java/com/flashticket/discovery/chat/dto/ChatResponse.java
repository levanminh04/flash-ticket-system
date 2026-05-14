package com.flashticket.discovery.chat.dto;

/**
 * Chat response DTO.
 *
 * @param sessionId   echoed session ID
 * @param message     AI response text
 * @param mood        detected user mood (EXCITED, STRESSED, SAD, RELAXED, NEUTRAL)
 * @param ragStrategy RAG strategy used (SIMPLE, MULTI_HOP, CRAG, DIRECT)
 */
public record ChatResponse(
    String sessionId,
    String message,
    String mood,
    String ragStrategy
) {}
