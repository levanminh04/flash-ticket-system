package com.flashticket.gateway;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;

@RestController
public class FallBackController {

    /**
     * NOTE, sau lên production phải chỉnh timeout của gateway xuống 1s chứ không thể 3-5s được,
     * Các request nặng cần đổi cách triển khai, dùng polling hoặc websocket,
     * không đợi mãi được vì thực thi quá 1s là gateway bắn lỗi timeout ngay
     * */


    /**
     * Lệnh forward: của Spring Cloud Gateway có một đặc điểm là giữ nguyên Method gốc của request.
     * Nếu gửi POST /api/chat, nó sẽ forward thành POST /fallback/discovery.
     * Vì vậy phải để @RequestMapping => chấp nhận mọi method
     * */

    @RequestMapping("/fallback/core")
    public ResponseEntity<List<String>> coreFallBack(){
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Collections.singletonList("Core service is currently slow or unavailable. Please try again later."));
    }

    @RequestMapping("/fallback/user")
    public ResponseEntity<List<String>> userFallBack(){
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Collections.singletonList("User service is currently slow or unavailable. Please try again later."));
    }

    @RequestMapping("/fallback/discovery")
    public ResponseEntity<List<String>> discoveryFallBack(){
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Collections.singletonList("Discovery service is currently slow or unavailable. Please try again later."));
    }
}
