# 🔄 Migration Guide: Google AI Studio → Vertex AI (GCP $300 Credit)

## Tóm tắt: Sửa đổi ÍT, chỉ 4 file

Tin tốt: Vì bạn đang dùng **LangChain4j**, thư viện này có sẵn module `langchain4j-vertex-ai-gemini` gần như **drop-in replacement** cho `langchain4j-google-ai-gemini`. Bạn **KHÔNG phải viết lại logic RAG, Tools, hay ChatMemory** — tất cả đều giữ nguyên.

---

## Tổng quan các file cần sửa

| # | File | Mức độ thay đổi | Mô tả |
|---|------|-----------------|-------|
| 1 | `pom.xml` | 🟢 Nhỏ | Đổi 1 dependency |
| 2 | `discovery-service.yml` (config server) | 🟢 Nhỏ | Đổi namespace YAML + thêm `project`/`location` |
| 3 | `LangChainConfig.java` | 🟡 Vừa | Đổi EmbeddingModel class + Qualifier name |
| 4 | `.env` | 🟢 Nhỏ | Thay `GEMINI_API_KEY` bằng `GCP_PROJECT_ID` + `GCP_LOCATION` |

> [!IMPORTANT]
> Tổng cộng chỉ sửa **~15-20 dòng code** trên 4 file. Toàn bộ logic RAG (AdaptiveRagRouter, CorrectiveRagStrategy, MultiHopRagStrategy), Tools (BookingTool, EventSearchTool, PaymentTool), ChatMemory — **giữ nguyên 100%**.

---

## Chi tiết từng file

### 1️⃣ `pom.xml` — Đổi 1 dependency

```diff
 <!-- ═══ LangChain4j ═══ -->
 <dependency>
     <groupId>dev.langchain4j</groupId>
-    <artifactId>langchain4j-google-ai-gemini-spring-boot-starter</artifactId>
+    <artifactId>langchain4j-vertex-ai-gemini-spring-boot-starter</artifactId>
     <version>${langchain4j.version}</version>
 </dependency>
```

> [!NOTE]
> Module `langchain4j-vertex-ai-gemini` cũng có version `1.0.0-beta5` — cùng version bạn đang dùng, nên không lo conflict.

---

### 2️⃣ `configserver/.../discovery-service.yml` — Đổi namespace YAML

```diff
 # LangChain4j Configuration
 langchain4j:
-  google-ai-gemini:
+  vertex-ai-gemini:
     chat-model:
-      api-key: ${GEMINI_API_KEY}
+      project: ${GCP_PROJECT_ID}
+      location: ${GCP_LOCATION:us-central1}
       model-name: ${GEMINI_MODEL:gemini-2.0-flash}
       temperature: 0.3
```

> [!TIP]
> Vertex AI **không dùng API Key**, mà xác thực qua **Application Default Credentials (ADC)** hoặc **Service Account JSON**. Bạn chỉ cần cung cấp `project` và `location`.

---

### 3️⃣ `LangChainConfig.java` — Đổi 2 chỗ

```diff
-import dev.langchain4j.model.googleai.GoogleAiEmbeddingModel;
+import dev.langchain4j.model.vertexai.VertexAiEmbeddingModel;

 @Bean
 EmbeddingModel embeddingModel(
-        @Value("${langchain4j.google-ai-gemini.chat-model.api-key}") String apiKey) {
-    return GoogleAiEmbeddingModel.builder()
-            .apiKey(apiKey)
+        @Value("${langchain4j.vertex-ai-gemini.chat-model.project}") String project,
+        @Value("${langchain4j.vertex-ai-gemini.chat-model.location}") String location) {
+    return VertexAiEmbeddingModel.builder()
+            .project(project)
+            .location(location)
             .modelName("gemini-embedding-001")
             .build();
 }
```

```diff
 @Bean
 DiscoveryAssistant discoveryAssistant(
-        @Qualifier("googleAiGeminiChatModel") ChatModel chatModel,
+        @Qualifier("vertexAiGeminiChatModel") ChatModel chatModel,
         AdaptiveRagRouter adaptiveRagRouter,
```

> [!NOTE]
> Spring Boot auto-configuration sẽ tự tạo bean `vertexAiGeminiChatModel` từ properties YAML. Bạn chỉ cần đổi tên Qualifier.

---

### 4️⃣ `.env` — Thay biến môi trường

```diff
-# Gemini AI (Primary — Free tier from Google AI Studio)
-GEMINI_API_KEY=AIzaSyD3ZSe4oZYM6qmEolIJOP-aJMB-RUWJGGQ
+# Vertex AI (GCP $300 Free Tier)
+GCP_PROJECT_ID=your-gcp-project-id
+GCP_LOCATION=us-central1
 
 GEMINI_MODEL=gemini-2.5-flash
```

---

## Thiết lập xác thực (1 lần duy nhất)

### Cách 1: Local Development (Nhanh nhất)

```bash
# Cài Google Cloud CLI rồi chạy:
gcloud auth application-default login
```
→ Trình duyệt mở ra, đăng nhập bằng tài khoản GCP có $300. **Xong!** SDK tự nhận credentials.

### Cách 2: Server / Docker (Dùng Service Account)

1. Tạo Service Account trên GCP Console → gán role **Vertex AI User**
2. Download file JSON key
3. Set biến môi trường:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

---

## So sánh: Google AI Studio vs Vertex AI

| Tiêu chí | Google AI Studio (hiện tại) | Vertex AI (đề xuất) |
|----------|---------------------------|---------------------|
| **Rate Limit** | 🔴 20 calls/day (free tier) | 🟢 Cao hơn rất nhiều (trả phí từ $300 credit) |
| **Xác thực** | API Key (chuỗi `AIzaSy...`) | IAM / Service Account |
| **Chi phí** | Miễn phí nhưng giới hạn cứng | Trừ từ $300 credit, không giới hạn cứng |
| **Model** | Gemini 2.5 Flash ✅ | Gemini 2.5 Flash ✅ (cùng model) |
| **Code thay đổi** | — | ~15-20 dòng trên 4 file |

---

## ⚠️ Lưu ý quan trọng

> [!WARNING]
> - **Mọi request đều tính phí** và trừ vào $300 credit. Theo dõi tab **Billing** trên GCP Console thường xuyên.
> - Vertex AI **không có "no-cost tier"** giống AI Studio. Nếu hết $300, API sẽ ngừng hoạt động (trừ khi bạn upgrade billing).
> - Ước tính: Gemini 2.5 Flash giá ~$0.075/1M input tokens → $300 credit ≈ **4 tỷ input tokens** → rất thoải mái cho development.

> [!CAUTION]
> Xóa các API Key cũ khỏi `.env` sau khi migrate. Các key `AIzaSy...` bị commit lên Git sẽ bị Google tự revoke.

---

## Kết luận

**Chỉ cần sửa 4 file, ~15-20 dòng code.** Toàn bộ kiến trúc RAG, Agentic AI, Tools, ChatMemory của bạn **giữ nguyên hoàn toàn**. Đây là một migration rất nhẹ nhàng nhờ LangChain4j đã abstract hóa tốt lớp model provider.

Bạn muốn tôi thực hiện migration luôn không?
