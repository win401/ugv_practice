package com.tbcrew.saemgil.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

// Swagger 화면 맨 위에 보이는 API 문서 제목과 설명.
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI saemgilOpenApi() {
        return new OpenAPI().info(new Info()
                .title("샘길 API")
                .description("정원 관수 UGV 백엔드 API")
                .version("v1"));
    }
}
