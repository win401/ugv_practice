package com.tbcrew.saemgil.user;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.tbcrew.saemgil.device.Device;
import com.tbcrew.saemgil.device.DeviceRepository;
import com.tbcrew.saemgil.garden.Garden;
import com.tbcrew.saemgil.garden.GardenRepository;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

// 관리자의 계정 관리: 목록, 추가(운영자·관리자), 수정(이름·연락처·비밀번호·정지), 삭제.
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    // 010-1234-5678, 02-123-4567 처럼 하이픈으로 나눈 전화번호
    private static final Pattern PHONE = Pattern.compile("^0\\d{1,2}-\\d{3,4}-\\d{4}$");
    // 공백을 뺀 영문·숫자·특수문자 8~16자
    private static final Pattern PASSWORD = Pattern.compile("^[\\x21-\\x7E]{8,16}$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;
    private final GardenRepository gardenRepository;
    private final DeviceRepository deviceRepository;

    @Transactional(readOnly = true)
    public List<User> list() {
        return userRepository.findAll(Sort.by("id"));
    }

    @Transactional
    public User create(CreateUserRequest request) {
        String email = request.email() == null ? "" : request.email().trim();
        String name = request.name() == null ? "" : request.name().trim();
        String phone = request.phone() == null ? "" : request.phone().trim();
        if (email.length() > 255 || !EMAIL.matcher(email).matches()) {
            throw badRequest("이메일 형식이 올바르지 않습니다.");
        }
        if (request.password() == null || !PASSWORD.matcher(request.password()).matches()) {
            throw badRequest("비밀번호는 영문·숫자·특수문자 8~16자로 입력해 주세요.");
        }
        if (name.isEmpty() || name.length() > 50) {
            throw badRequest("이름은 1~50자로 입력해 주세요.");
        }
        requirePhone(phone);
        UserRole role = parseRole(request.role());
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록된 이메일입니다.");
        }
        try {
            User saved = userRepository.saveAndFlush(
                    new User(email, passwordEncoder.encode(request.password()), role, name, phone));
            // 가입일은 DB가 채우므로 다시 읽어 응답에 담는다.
            entityManager.refresh(saved);
            return saved;
        } catch (DataIntegrityViolationException e) {
            // 위 확인과 저장 사이에 같은 이메일이 먼저 들어간 경우
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록된 이메일입니다.");
        }
    }

    // 보낸 값만 고친다. 이메일과 역할은 바꾸지 않는다.
    @Transactional
    public User update(Long id, UpdateUserRequest request, Long currentUserId) {
        User user = find(id);
        if (request.name() != null) {
            String name = request.name().trim();
            if (name.isEmpty() || name.length() > 50) {
                throw badRequest("이름은 1~50자로 입력해 주세요.");
            }
            user.rename(name);
        }
        if (request.phone() != null) {
            String phone = request.phone().trim();
            requirePhone(phone);
            user.changePhone(phone);
        }
        if (request.password() != null) {
            if (!PASSWORD.matcher(request.password()).matches()) {
                throw badRequest("비밀번호는 영문·숫자·특수문자 8~16자로 입력해 주세요.");
            }
            user.changePasswordHash(passwordEncoder.encode(request.password()));
        }
        if (request.status() != null) {
            UserStatus status = parseStatus(request.status());
            if (status == UserStatus.SUSPENDED && user.getId().equals(currentUserId)) {
                throw badRequest("자기 계정은 정지할 수 없습니다.");
            }
            user.changeStatus(status);
        }
        return user;
    }

    // 계정과 그 계정의 정원을 함께 지운다. 되돌릴 수 없다.
    // 지우는 정원에서 작업 중이던 장비는 대기 상태로 돌린다. 장비 자체는 남는다.
    @Transactional
    public void delete(Long id, Long currentUserId) {
        User user = find(id);
        if (user.getId().equals(currentUserId)) {
            throw badRequest("자기 계정은 삭제할 수 없습니다.");
        }
        List<Garden> gardens = gardenRepository.findByOwnerId(id);
        for (Garden garden : gardens) {
            deviceRepository.findByActiveGardenId(garden.getId()).forEach(Device::stopWork);
        }
        // 장비가 정원을 가리키는 값을 먼저 비워야 정원을 지울 수 있다.
        deviceRepository.flush();
        gardenRepository.deleteAll(gardens);
        userRepository.delete(user);
    }

    private User find(Long id) {
        return userRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "계정을 찾을 수 없습니다."));
    }

    // 연락처는 비워 두거나 010-1234-5678 형식이어야 한다.
    private static void requirePhone(String phone) {
        if (!phone.isEmpty() && !PHONE.matcher(phone).matches()) {
            throw badRequest("연락처는 010-1234-5678 형식으로 입력해 주세요.");
        }
    }

    private static UserRole parseRole(String role) {
        try {
            return UserRole.valueOf(String.valueOf(role).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw badRequest("역할 값이 올바르지 않습니다.");
        }
    }

    private static UserStatus parseStatus(String status) {
        try {
            return UserStatus.valueOf(String.valueOf(status).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw badRequest("상태 값이 올바르지 않습니다.");
        }
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
