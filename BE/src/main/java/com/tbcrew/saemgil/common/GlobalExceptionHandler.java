package com.tbcrew.saemgil.common;

import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

// 모든 에러 응답을 { status, title, detail } 모양 (ProblemDetail)으로 맞춘다.
// 404, 400 같은 Spring 기본 에러는 부모 클래스가 이 모양으로 만들어 준다.
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // 요청 값 검사(@Valid)에 걸리면 다른 400과 같이 detail에 안내 문장 하나를 담는다.
    // 문장은 검사 규칙에 적은 message(예: @NotBlank(message = "이름을 입력해 주세요."))를 그대로 쓴다.
    // 여러 값이 걸려도 하나만 보낸다(화면은 detail 한 줄을 그대로 보여 준다). 매번 같은 문장이 나오게 글자순으로 고른다.
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .filter(Objects::nonNull)
                .sorted()
                .findFirst()
                .orElse("입력값이 올바르지 않습니다.");
        return handleExceptionInternal(ex, ProblemDetail.forStatusAndDetail(status, detail), headers, status, request);
    }

    // 처리하지 못한 예외는 내부 내용을 숨기고 500으로 응답한다. 원인은 서버 로그에 남긴다.
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception e) {
        log.error("처리하지 못한 예외", e);
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다.");
    }
}
