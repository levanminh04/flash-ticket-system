package com.flashticket.core.event.config;

import com.flashticket.core.event.client.UserServiceClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

import java.util.Optional;


@Configuration
@Slf4j
public class UserServiceClientConfig {


    @Bean
    @LoadBalanced
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }


    @Bean
    public UserServiceClient userServiceClient(RestClient.Builder restClientBuilder) {
        log.info("Initializing UserServiceClient with Eureka load balancing");

        RestClient restClient = restClientBuilder
                .baseUrl("http://user-service") // Eureka service name (không phải URL cứng)
                .defaultStatusHandler(
                        HttpStatusCode::is4xxClientError,
                        (request, response) -> {
                            log.warn("User Service returned 4xx for: {} {}", request.getMethod(), request.getURI());
                            // Trả về Optional.empty() thay vì throw exception
                        })
                .defaultStatusHandler(
                        HttpStatusCode::is5xxServerError,
                        (request, response) -> {
                            log.error("User Service returned 5xx for: {} {}",
                                    request.getMethod(), request.getURI());
                        })
                .build();

        RestClientAdapter adapter = RestClientAdapter.create(restClient);
        HttpServiceProxyFactory factory = HttpServiceProxyFactory
                .builderFor(adapter)
                .build();

        return factory.createClient(UserServiceClient.class);
    }
}
