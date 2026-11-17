package com.tbcrew.saemgil.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.tbcrew.saemgil.WithSecurityConfig;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 요청 값 검사(@Valid)에 걸렸을 때도 다른 400과 같은 모양으로, 규칙에 적은 안내 문장이 detail에 담기는지 확인한다.
// 아직 @Valid를 쓰는 컨트롤러가 없어서 이 테스트 안에 시험용 컨트롤러를 둔다.
@WebMvcTest(ValidationErrorTest.ProbeController.class)
@Import(ValidationErrorTest.ProbeController.class)
@WithSecurityConfig
class ValidationErrorTest {

    record ProbeRequest(
            @NotBlank(message = "이름을 입력해 주세요.") @Size(max = 5, message = "이름은 5자 이하로 입력해 주세요.") String name) {
    }

    @RestController
    static class ProbeController {
        @PostMapping("/test/validation")
        String check(@Valid @RequestBody ProbeRequest request) {
            return request.name();
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser
    void invalidValueGetsKoreanDetail() throws Exception {
        mockMvc.perform(post("/test/validation").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType("application/problem+json"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("이름을 입력해 주세요."));

        mockMvc.perform(post("/test/validation").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"여섯글자이름\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("이름은 5자 이하로 입력해 주세요."));
    }

    @Test
    @WithMockUser
    void validValuePasses() throws Exception {
        mockMvc.perform(post("/test/validation").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"장미원\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string("장미원"));
    }
}
