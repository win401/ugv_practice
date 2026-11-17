package com.tbcrew.saemgil.common;

import java.math.BigDecimal;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

// 일부만 고치는 요청(PATCH)의 본문. "보내지 않은 값"과 "null로 보낸 값"을 구분해야 해서 Map으로 받는다.
// 예: deviceId를 보내지 않으면 그대로 두고, null로 보내면 장비 배정을 푼다.
// 형식이 맞지 않으면 400으로 거절한다.
public record Patch(Map<String, Object> values) {

    public boolean has(String key) {
        return values.containsKey(key);
    }

    public boolean isNull(String key) {
        return values.get(key) == null;
    }

    // 앞뒤 공백을 뺀 글자. 빈 값을 허용하지 않으려면 required를 true로 준다.
    public String text(String key, int maxLength, boolean required) {
        if (!(values.get(key) instanceof String value)) {
            throw invalid(key);
        }
        String trimmed = value.trim();
        if (trimmed.length() > maxLength || (required && trimmed.isEmpty())) {
            throw invalid(key);
        }
        return trimmed;
    }

    public boolean flag(String key) {
        if (!(values.get(key) instanceof Boolean value)) {
            throw invalid(key);
        }
        return value;
    }

    public int integer(String key, int min, int max) {
        if (!(values.get(key) instanceof Number value) || value.doubleValue() != value.intValue()
                || value.intValue() < min || value.intValue() > max) {
            throw invalid(key);
        }
        return value.intValue();
    }

    public BigDecimal decimal(String key) {
        if (!(values.get(key) instanceof Number value)) {
            throw invalid(key);
        }
        return new BigDecimal(value.toString());
    }

    // 화면은 id를 글자로 다루므로 "12"와 12를 모두 받는다.
    public long id(String key) {
        try {
            return Long.parseLong(String.valueOf(values.get(key)));
        } catch (NumberFormatException e) {
            throw invalid(key);
        }
    }

    public static ResponseStatusException invalid(String key) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " 값이 올바르지 않습니다.");
    }
}
