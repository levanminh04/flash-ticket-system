package com.flashticket.spi;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import org.jboss.logging.Logger;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

public class RabbitMqEventListenerProvider implements EventListenerProvider {
// EventListenerProvider chính là interface do keycloak cung cấp, keycloak viết code java và gói thành 1 .jar sau đó đẩy lên maven repository (kho lưu trữ thư viện java toàn thế giới)
// Mình chỉ cần gọi dependency về là dùng được interface EventListenerProvider

    private static final Logger log = Logger.getLogger(RabbitMqEventListenerProvider.class);
    private final KeycloakSession session;
    private final Connection connection;
    private final String exchange;
    private final ObjectMapper mapper;

//    Chạy nhiều lần → không tạo resource nặng ở đây (không tạo connection mới)
//    KeycloakSession chỉ sống trong 1 request → không lưu lại dùng sau
//    Provider sống trong 1 request → không lưu state:
    public RabbitMqEventListenerProvider(KeycloakSession session, Connection connection, String exchange) {
        this.session = session;
        this.connection = connection;
        this.exchange = exchange;
        this.mapper = new ObjectMapper();
    }

    @Override
    public void onEvent(Event event) { // Xử lý các hành động của người dùng thông thường:
        try {
            // We only care about "end-user events" like REGISTER, UPDATE_PROFILE, DELETE_ACCOUNT etc.
            switch (event.getType()) {
                case REGISTER:
                case UPDATE_PROFILE:
                case UPDATE_EMAIL:
                case DELETE_ACCOUNT:
                    publishUserEvent(event);
                    break;
                default:
                    // Ignore login, code_to_token, etc.
                    break;
            }
        } catch (Exception e) {
            log.error("Top-level error in RabbitMQ Event Listener (User Event)", e);
        }
    }

    @Override // Xử lý các hành động của admin qua Admin UI hoặc Admin API
    public void onEvent(AdminEvent adminEvent, boolean includeRepresentation) {
        try {
            // Listen to "Admin actions" like creating user, updating user, or deleting user via API.
            switch (adminEvent.getOperationType()) {
                case CREATE:
                case UPDATE:
                case DELETE:
                    if ("USER".equals(adminEvent.getResourceTypeAsString())) {
                        publishAdminUserEvent(adminEvent);
                    }
                    break;
                default:
                    break;
            }
        } catch (Exception e) {
            log.error("Top-level error in RabbitMQ Event Listener (Admin Event)", e);
        }
    }
//    Các thông tin lấy được từ `Event`:
//            | Method                      | Trả về |
//            | `event.getType()`           | Loại event: REGISTER, LOGIN... |
//            | `event.getUserId()`         | ID của user |
//            | `event.getRealmId()`        | ID của realm |
//            | `event.getClientId()`       | App nào trigger event |
//            | `event.getIpAddress()`      | IP của user |
//            | `event.getTime()`           | Thời điểm xảy ra |
//            | `event.getError()`          | Lỗi nếu có (LOGIN_ERROR...) |
    private void publishUserEvent(Event event) {
        try {
            RealmModel realm = session.realms().getRealm(event.getRealmId());
            UserModel user = session.users().getUserById(realm, event.getUserId());

            Map<String, Object> payload = new HashMap<>();
            if (user != null) {
                payload.put("userId", user.getId());
                payload.put("email", user.getEmail());
                payload.put("firstName", user.getFirstName());
                payload.put("lastName", user.getLastName());
                payload.put("emailVerified", user.isEmailVerified());
                payload.put("attributes", user.getAttributes());
                
                // Trích xuất Roles thực sự của User (BUYER, ORGANIZER...)
                List<String> roles = user.getRoleMappingsStream()
                        .map(RoleModel::getName)
                        .collect(Collectors.toList());
                payload.put("roles", roles);
            } else {
                // If the user was just deleted, we only have the ID from the event
                payload.put("userId", event.getUserId());
            }

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("realmId", event.getRealmId());
            metadata.put("clientId", event.getClientId());
            metadata.put("ipAddress", event.getIpAddress());

            Map<String, Object> cloudEvent = new HashMap<>();
            cloudEvent.put("eventId", UUID.randomUUID().toString());
            cloudEvent.put("eventType", "USER_" + event.getType().toString());
            cloudEvent.put("timestamp", event.getTime());
            cloudEvent.put("source", "keycloak");
            cloudEvent.put("metadata", metadata);
            cloudEvent.put("payload", payload);

            publishMessage(event.getType().toString(), cloudEvent);

        } catch (Exception e) {
            log.error("Failed to publish User Event", e);
        }
    }
//    Các thông tin lấy được từ `AdminEvent`:
//            | Method                                  | Trả về |
//            | `adminEvent.getOperationType()`         | CREATE, UPDATE, DELETE, ACTION |
//            | `adminEvent.getResourceTypeAsString()`  | "USER", "CLIENT", "ROLE"... |
//            | `adminEvent.getResourcePath()`          | "users/abc-123" |
//            | `adminEvent.getRealmId()`               | ID của realm |
//            | `adminEvent.getAuthDetails()`           | Thông tin admin thực hiện |
//            | `adminEvent.getRepresentation()`        | JSON của object bị thay đổi |
    private void publishAdminUserEvent(AdminEvent adminEvent) {
        try {
            // Admin events don't have getUserId directly, the ID is the resource path (e.g. users/8123-12j3...)
            String resourcePath = adminEvent.getResourcePath();
            String userId = resourcePath.startsWith("users/") ? resourcePath.substring(6) : resourcePath;

            RealmModel realm = session.realms().getRealm(adminEvent.getRealmId());
            UserModel user = null;
            if (userId != null && !userId.isEmpty()) {
                user = session.users().getUserById(realm, userId);
            }

            Map<String, Object> payload = new HashMap<>();
            if (user != null) {
                payload.put("userId", user.getId());
                payload.put("email", user.getEmail());
                payload.put("firstName", user.getFirstName());
                payload.put("lastName", user.getLastName());
                payload.put("emailVerified", user.isEmailVerified());
                payload.put("attributes", user.getAttributes());

                // Trích xuất Roles thực sự của User (ADMIN, ORGANIZER...)
                List<String> roles = user.getRoleMappingsStream()
                        .map(RoleModel::getName)
                        .collect(Collectors.toList());
                payload.put("roles", roles);
            } else {
                payload.put("userId", userId);
            }

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("realmId", adminEvent.getRealmId());
            metadata.put("clientId", adminEvent.getAuthDetails().getClientId());
            metadata.put("ipAddress", adminEvent.getAuthDetails().getIpAddress());

            Map<String, Object> cloudEvent = new HashMap<>();
            cloudEvent.put("eventId", UUID.randomUUID().toString());
            cloudEvent.put("eventType", "ADMIN_USER_" + adminEvent.getOperationType().toString());
            cloudEvent.put("timestamp", adminEvent.getTime());
            cloudEvent.put("source", "keycloak");
            cloudEvent.put("metadata", metadata);
            cloudEvent.put("payload", payload);

            publishMessage("ADMIN_" + adminEvent.getOperationType().toString(), cloudEvent);

        } catch (Exception e) {
            log.error("Failed to publish Admin Event", e);
        }
    }

    private void publishMessage(String routingKey, Map<String, Object> messageMap) {
        if (connection == null || !connection.isOpen()) {
            log.warn("Cannot publish event, RabbitMQ connection is absent or closed.");
            return;
        }

        try (Channel channel = connection.createChannel()) {
            // Declare exchange as Topic to allow flexible routing (e.g. REGISTER, UPDATE_PROFILE)
            channel.exchangeDeclare(exchange, "topic", true);
            
            String jsonMessage = mapper.writeValueAsString(messageMap);
            
            channel.basicPublish(exchange, routingKey.toLowerCase(), null, jsonMessage.getBytes("UTF-8"));
            log.debugv("Published event {0} to exchange {1}", routingKey, exchange);
        } catch (Exception e) {
            log.error("Failed to publish message to RabbitMQ", e);
        }
    }

    @Override
    public void close() {
        // Nothing specific to close per instance, the connection is shared via Factory
    }
}
