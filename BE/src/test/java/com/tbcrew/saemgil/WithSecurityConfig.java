package com.tbcrew.saemgil;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.tbcrew.saemgil.auth.JwtTokenProvider;
import com.tbcrew.saemgil.common.SecurityConfig;
import com.tbcrew.saemgil.user.UserRepository;

// @WebMvcTest에 붙여 실제 보안 규칙(SecurityConfig)으로 시험한다.
// @WebMvcTest는 DB를 띄우지 않으므로 사용자 조회(UserRepository)는 가짜로 둔다.
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Import({ SecurityConfig.class, JwtTokenProvider.class })
@MockitoBean(types = UserRepository.class)
public @interface WithSecurityConfig {
}
