# AI Service

AI Service with RAG (Retrieval-Augmented Generation) Chatbot for TicketBox.

## Features

- **RAG Chatbot**: Intelligent chatbot using LangChain4j and OpenAI
- **Vector Search**: pgvector for semantic search
- **Event Indexing**: Kafka consumer to index events for RAG

## Tech Stack

- Spring Boot 3.2
- LangChain4j
- PostgreSQL + pgvector
- OpenAI API
- Kafka (Event consumer)

## Configuration

Set the following environment variables:

```bash
OPENAI_API_KEY=your-openai-api-key
```

## Running

```bash
mvn spring-boot:run
```

The service will run on port **8085**.
