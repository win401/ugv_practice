package com.tbcrew.saemgil;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// 로그인은 JWT 쿠키(auth 패키지)로 직접 처리한다. Spring이 시험용 계정을 만들고 비밀번호를 로그에 찍지 않도록 끈다.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class SaemgilApplication {

	public static void main(String[] args) {
		SpringApplication.run(SaemgilApplication.class, args);
	}

}
