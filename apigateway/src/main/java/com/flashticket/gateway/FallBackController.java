package com.flashticket.gateway;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class FallBackController {

    @GetMapping("/fallback/products")
    public ResponseEntity<List<String>> productsFallBack(){
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Collections.singletonList("Product service is not unavalable"));
    }
    @RequestMapping("/fallback/core")
    public ResponseEntity<Map<String, Object>> coreFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(buildFallbackBody("CORE-SERVICE is temporarily unavailable"));
    }
    @RequestMapping("/fallback/user")
    public ResponseEntity<Map<String, Object>> userFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(buildFallbackBody("USER-SERVICE is temporarily unavailable"));
    }
    @RequestMapping("/fallback/ai")
    public ResponseEntity<Map<String, Object>> aiFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(buildFallbackBody("AI-SERVICE is temporarily unavailable"));
    }
    private Map<String, Object> buildFallbackBody(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", 503);
        body.put("error", "Service Unavailable");
        body.put("message", message);
        return body;
    }
}
