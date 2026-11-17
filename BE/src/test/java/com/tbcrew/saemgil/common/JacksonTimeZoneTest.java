package com.tbcrew.saemgil.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Date;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;

import tools.jackson.databind.json.JsonMapper;

// JSON으로 내보내는 날짜가 UTC가 아니라 한국 시간(+09:00)인지 확인한다.
@JsonTest
class JacksonTimeZoneTest {

    @Autowired
    private JsonMapper jsonMapper;

    @Test
    void writesDatesInKst() {
        // 1970-01-01T00:00Z = 한국 시간 09:00
        String json = jsonMapper.writeValueAsString(new Date(0));

        assertThat(json).contains("09:00:00").contains("+09:00");
    }
}
