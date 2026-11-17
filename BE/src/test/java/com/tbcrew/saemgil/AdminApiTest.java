package com.tbcrew.saemgil;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.tbcrew.saemgil.auth.AuthCookies;
import com.tbcrew.saemgil.device.Device;
import com.tbcrew.saemgil.device.DeviceRepository;
import com.tbcrew.saemgil.garden.Garden;
import com.tbcrew.saemgil.garden.GardenRepository;
import com.tbcrew.saemgil.user.User;
import com.tbcrew.saemgil.user.UserRepository;
import com.tbcrew.saemgil.user.UserRole;

import jakarta.servlet.http.Cookie;

// 관리자 API(계정·장비·정원)를 실제 MySQL과 실제 로그인 쿠키로 확인한다.
// 다른 테스트와 DB를 같이 쓰므로 앞뒤로 비운다.
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AdminApiTest {

    private static final String PASSWORD = "demo1234";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DeviceRepository deviceRepository;
    @Autowired
    private GardenRepository gardenRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User admin;
    private User kim;
    private User jung;
    private Cookie adminCookie;

    @BeforeEach
    void setUp() throws Exception {
        clear();
        admin = user("admin@example.com", UserRole.ADMIN, "관리자");
        kim = user("kim@example.com", UserRole.OPERATOR, "김정원");
        jung = user("jung@example.com", UserRole.OPERATOR, "정바람");
        adminCookie = loginCookie("admin@example.com");
    }

    @AfterEach
    void clear() {
        jdbcTemplate.update("UPDATE devices SET active_garden_id = NULL");
        jdbcTemplate.update("DELETE FROM gardens");
        jdbcTemplate.update("DELETE FROM devices");
        jdbcTemplate.update("DELETE FROM users");
    }

    @Test
    void operatorAndGuestCannotUseAdminApi() throws Exception {
        mockMvc.perform(get("/api/admin/users").cookie(loginCookie("kim@example.com")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/devices"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void operatorDashboardShowsOnlyOwnActiveGardens() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));
        deviceRepository.save(new Device("ROVEN-02", "RV-0002", "1.4.2"));
        garden(kim, "장미원", "ROVEN-01");
        Garden hidden = garden(kim, "쉬는 정원", null);
        garden(jung, "바람정원", "ROVEN-02");
        mockMvc.perform(json(patch("/api/admin/gardens/" + hidden.getId()), "{\"status\":\"inactive\"}"))
                .andExpect(status().isOk());

        // 운영자는 자기 정원과 그 정원의 장비만 본다. 다른 계정을 요청해도 무시한다.
        mockMvc.perform(get("/api/me/dashboard").param("customerId", String.valueOf(jung.getId()))
                .cookie(loginCookie("kim@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("kim@example.com"))
                .andExpect(jsonPath("$.gardens.length()").value(1))
                .andExpect(jsonPath("$.gardens[0].name").value("장미원"))
                .andExpect(jsonPath("$.gardens[0].geojson.type").value("Polygon"))
                .andExpect(jsonPath("$.devices.length()").value(1))
                .andExpect(jsonPath("$.devices[0].id").value("ROVEN-01"))
                .andExpect(jsonPath("$.records.length()").value(0))
                .andExpect(jsonPath("$.viewAs").doesNotExist());
        mockMvc.perform(get("/api/me/dashboard"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminDashboardStartsWithOwnGardensAndCanViewCustomers() throws Exception {
        garden(admin, "먼저 등록한 정원", null);
        garden(admin, "시험 정원", null);
        garden(jung, "바람정원", null);

        // 처음에는 자기 정원. 고를 수 있는 목록은 자기 자신과, 정원이 있는 운영자다(김정원은 정원이 없어 빠진다).
        mockMvc.perform(get("/api/me/dashboard").cookie(adminCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gardens[0].name").value("시험 정원"))
                .andExpect(jsonPath("$.viewAs.customerId").value(admin.getId()))
                .andExpect(jsonPath("$.viewAs.customers.length()").value(2))
                .andExpect(jsonPath("$.viewAs.customers[0].name").value("관리자 (내 정원)"))
                .andExpect(jsonPath("$.viewAs.customers[1].name").value("정바람"));

        mockMvc.perform(get("/api/me/dashboard").param("customerId", String.valueOf(jung.getId()))
                .cookie(adminCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gardens[0].name").value("바람정원"))
                .andExpect(jsonPath("$.viewAs.customerId").value(jung.getId()));

        // 고를 수 없는 계정을 요청하면 자기 정원으로 돌아간다.
        mockMvc.perform(get("/api/me/dashboard").param("customerId", String.valueOf(kim.getId()))
                .cookie(adminCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewAs.customerId").value(admin.getId()));
    }

    @Test
    void listsUsersWithoutPassword() throws Exception {
        mockMvc.perform(get("/api/admin/users").cookie(adminCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].email").value("admin@example.com"))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$[0].password").doesNotExist());
    }

    @Test
    void createsOperatorWhoCanLogIn() throws Exception {
        mockMvc.perform(json(post("/api/admin/users"), """
                {"email":" new@example.com ","password":"abcd!1234","role":"operator","name":"새 고객","phone":"010-1111-2222"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("new@example.com"))
                .andExpect(jsonPath("$.role").value("operator"))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.joined").exists())
                .andExpect(jsonPath("$.password").doesNotExist());

        mockMvc.perform(login("new@example.com", "abcd!1234")).andExpect(status().isOk());
    }

    @Test
    void createsAdmin() throws Exception {
        mockMvc.perform(json(post("/api/admin/users"), """
                {"email":"admin2@example.com","password":"abcd!1234","role":"admin","name":"관리자2","phone":""}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("admin"));
    }

    @Test
    void rejectsBadUserInput() throws Exception {
        // 이미 있는 이메일(대소문자만 다름)
        mockMvc.perform(json(post("/api/admin/users"), """
                {"email":"KIM@example.com","password":"abcd!1234","role":"operator","name":"중복","phone":""}"""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("이미 등록된 이메일입니다."));
        // 비밀번호: 7자, 17자, 한글, 공백
        for (String password : new String[] { "abc!123", "abcdefgh!12345678", "비밀번호1234abcd", "abcd 1234" }) {
            mockMvc.perform(json(post("/api/admin/users"), """
                    {"email":"x@example.com","password":"%s","role":"operator","name":"이름","phone":""}"""
                    .formatted(password)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value("비밀번호는 영문·숫자·특수문자 8~16자로 입력해 주세요."));
        }
        mockMvc.perform(json(post("/api/admin/users"), """
                {"email":"not-an-email","password":"abcd!1234","role":"operator","name":"이름","phone":""}"""))
                .andExpect(status().isBadRequest());
        mockMvc.perform(json(post("/api/admin/users"), """
                {"email":"x@example.com","password":"abcd!1234","role":"owner","name":"이름","phone":""}"""))
                .andExpect(status().isBadRequest());
        mockMvc.perform(json(post("/api/admin/users"), """
                {"email":"x@example.com","password":"abcd!1234","role":"operator","name":" ","phone":""}"""))
                .andExpect(status().isBadRequest());
        assertThat(userRepository.count()).isEqualTo(3);
    }

    @Test
    void suspendsAndRestoresButNotSelf() throws Exception {
        mockMvc.perform(json(patch("/api/admin/users/" + kim.getId()), "{\"status\":\"suspended\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("suspended"));
        mockMvc.perform(login("kim@example.com", PASSWORD)).andExpect(status().isForbidden());

        mockMvc.perform(json(patch("/api/admin/users/" + kim.getId()), "{\"status\":\"active\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(login("kim@example.com", PASSWORD)).andExpect(status().isOk());

        mockMvc.perform(json(patch("/api/admin/users/" + admin.getId()), "{\"status\":\"suspended\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("자기 계정은 정지할 수 없습니다."));
        mockMvc.perform(json(patch("/api/admin/users/999999"), "{\"status\":\"suspended\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void editsNameAndPhoneAndResetsPassword() throws Exception {
        mockMvc.perform(json(patch("/api/admin/users/" + kim.getId()), """
                {"name":" 김정원2 ","phone":"010-9999-0000","password":"new!pass12"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("김정원2"))
                .andExpect(jsonPath("$.phone").value("010-9999-0000"))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.password").doesNotExist());

        // 새 비밀번호로만 로그인된다.
        mockMvc.perform(login("kim@example.com", "new!pass12")).andExpect(status().isOk());
        mockMvc.perform(login("kim@example.com", PASSWORD)).andExpect(status().isUnauthorized());

        mockMvc.perform(json(patch("/api/admin/users/" + kim.getId()), """
                {"password":"short"}"""))
                .andExpect(status().isBadRequest());
        mockMvc.perform(json(patch("/api/admin/users/" + kim.getId()), """
                {"name":" "}"""))
                .andExpect(status().isBadRequest());
        // 연락처는 비우거나 010-1234-5678 형식만 받는다.
        mockMvc.perform(json(patch("/api/admin/users/" + kim.getId()), """
                {"phone":"01099990000"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("연락처는 010-1234-5678 형식으로 입력해 주세요."));
        // 이름만 보내면 나머지는 그대로다.
        mockMvc.perform(json(patch("/api/admin/users/" + kim.getId()), """
                {"name":"김정원3"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("010-9999-0000"));
        mockMvc.perform(login("kim@example.com", "new!pass12")).andExpect(status().isOk());
    }

    @Test
    void deletesAccountWithItsGardens() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));
        Garden garden = garden(kim, "장미원", "ROVEN-01");
        garden(kim, "초화원", null);
        Garden other = garden(jung, "바람정원", null);
        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-01"),
                "{\"online\":true,\"state\":\"working\",\"activeGardenId\":" + garden.getId() + "}"))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/admin/users/" + kim.getId()).cookie(adminCookie))
                .andExpect(status().isNoContent());

        assertThat(userRepository.findById(kim.getId())).isEmpty();
        assertThat(gardenRepository.findAll()).extracting(Garden::getId).containsExactly(other.getId());
        // 장비는 남고, 하던 작업만 멈춘다.
        Device device = deviceRepository.findById("ROVEN-01").orElseThrow();
        assertThat(device.getState().name()).isEqualTo("IDLE");
        assertThat(device.getActiveGardenId()).isNull();
        mockMvc.perform(login("kim@example.com", PASSWORD)).andExpect(status().isUnauthorized());
    }

    @Test
    void cannotDeleteSelfOrUnknown() throws Exception {
        mockMvc.perform(delete("/api/admin/users/" + admin.getId()).cookie(adminCookie))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("자기 계정은 삭제할 수 없습니다."));
        mockMvc.perform(delete("/api/admin/users/999999").cookie(adminCookie))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/admin/users/" + jung.getId()).cookie(loginCookie("kim@example.com")))
                .andExpect(status().isForbidden());
        assertThat(userRepository.count()).isEqualTo(3);
    }

    @Test
    void registersDevicesWithNextNumber() throws Exception {
        mockMvc.perform(json(post("/api/admin/devices"), "{\"serial\":\"RV-0001\",\"firmware\":\"1.4.2\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("ROVEN-01"))
                .andExpect(jsonPath("$.online").value(false))
                .andExpect(jsonPath("$.state").value("idle"))
                .andExpect(jsonPath("$.lastSeen").doesNotExist())
                .andExpect(jsonPath("$.registered").exists());
        mockMvc.perform(json(post("/api/admin/devices"), "{\"serial\":\"RV-0002\",\"firmware\":\"1.4.2\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("ROVEN-02"));

        mockMvc.perform(json(post("/api/admin/devices"), "{\"serial\":\"RV-0001\",\"firmware\":\"1.4.2\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("이미 등록된 시리얼 번호입니다."));
        mockMvc.perform(json(post("/api/admin/devices"), "{\"serial\":\" \",\"firmware\":\"1.4.2\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/admin/devices").cookie(adminCookie))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void updatesDeviceValues() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));

        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-01"),
                "{\"online\":true,\"state\":\"charging\",\"battery\":42,\"water\":7}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.online").value(true))
                .andExpect(jsonPath("$.state").value("charging"))
                .andExpect(jsonPath("$.battery").value(42))
                .andExpect(jsonPath("$.water").value(7))
                .andExpect(jsonPath("$.lastSeen").exists());

        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-01"), "{\"battery\":101}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-01"), "{\"state\":\"flying\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-99"), "{\"battery\":10}"))
                .andExpect(status().isNotFound());
    }

    private static final String BOUNDARY = """
            [{"kind":"M","points":[[127.49812,34.92965]]},{"kind":"L","points":[[127.49889,34.9299]]},\
            {"kind":"Q","points":[[127.4998,34.9299],[127.4998,34.9292]]},{"kind":"L","points":[[127.49826,34.92855]]},\
            {"kind":"Z","points":[]}]""";
    private static final String POLYGON = """
            {"type":"Polygon","coordinates":[[[127.49812,34.92965],[127.49889,34.9299],[127.49957,34.92972],\
            [127.4998,34.9292],[127.49826,34.92855],[127.49812,34.92965]]]}""";

    private String newGarden(User owner, String name, String area, String deviceIdJson, String boundary,
            String polygon) {
        return """
                {"customerId":%d,"name":"%s","address":"전라남도 순천시 국가정원1호길 47","flower":"장미",\
                "area":%s,"deviceId":%s,"centerLat":34.92923,"centerLng":127.49889,"boundary":%s,"geojson":%s}"""
                .formatted(owner.getId(), name, area, deviceIdJson, boundary, polygon);
    }

    @Test
    void registersGardenWithBoundary() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));

        mockMvc.perform(json(post("/api/admin/gardens"),
                newGarden(kim, " 장미원 ", "4820.5", "\"ROVEN-01\"", BOUNDARY, POLYGON)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.name").value("장미원"))
                .andExpect(jsonPath("$.customerId").value(kim.getId()))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.deviceId").value("ROVEN-01"))
                .andExpect(jsonPath("$.area").value(4820.5))
                .andExpect(jsonPath("$.centerLat").value(34.92923))
                .andExpect(jsonPath("$.registered").exists())
                .andExpect(jsonPath("$.boundary[2].kind").value("Q"))
                .andExpect(jsonPath("$.geojson.coordinates[0].length()").value(6));

        // 관리자 계정도 정원 주인이 될 수 있다.
        mockMvc.perform(json(post("/api/admin/gardens"),
                newGarden(admin, "시험 정원", "100", "null", BOUNDARY, POLYGON)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId").doesNotExist());
        assertThat(gardenRepository.count()).isEqualTo(2);
    }

    @Test
    void rejectsBadGardenInput() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));
        garden(kim, "장미원", "ROVEN-01");

        // 같은 고객의 같은 이름
        mockMvc.perform(json(post("/api/admin/gardens"), newGarden(kim, "장미원", "100", "null", BOUNDARY, POLYGON)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("이 고객에게 같은 이름의 정원이 있습니다."));
        // 다른 고객의 정원을 맡은 장비
        mockMvc.perform(json(post("/api/admin/gardens"),
                newGarden(jung, "바람정원", "100", "\"ROVEN-01\"", BOUNDARY, POLYGON)))
                .andExpect(status().isConflict());
        // 면적 0과 너무 작은 면적, 빈 이름
        mockMvc.perform(json(post("/api/admin/gardens"), newGarden(jung, "바람정원", "0", "null", BOUNDARY, POLYGON)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(json(post("/api/admin/gardens"),
                newGarden(jung, "바람정원", "0.001", "null", BOUNDARY, POLYGON)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("정원 면적은 0보다 커야 합니다."));
        mockMvc.perform(json(post("/api/admin/gardens"), newGarden(jung, " ", "100", "null", BOUNDARY, POLYGON)))
                .andExpect(status().isBadRequest());
        // 닫히지 않은 경계, 범위를 벗어난 좌표, 경계 원본이 Z로 끝나지 않음
        String open = POLYGON.replace("[127.49812,34.92965]]]}", "[127.49813,34.92965]]]}");
        String outOfRange = POLYGON.replace("127.4998,34.9292", "227.4998,34.9292");
        String noClose = BOUNDARY.replace(",{\"kind\":\"Z\",\"points\":[]}", "");
        for (String[] bad : new String[][] { { BOUNDARY, open }, { BOUNDARY, outOfRange }, { noClose, POLYGON },
                { "\"M0 0\"", POLYGON }, { BOUNDARY, "{\"type\":\"Point\",\"coordinates\":[127.5,34.9]}" } }) {
            mockMvc.perform(json(post("/api/admin/gardens"), newGarden(jung, "바람정원", "100", "null", bad[0], bad[1])))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value("정원 경계가 올바르지 않습니다. 지도에서 다시 그려 주세요."));
        }
        // 없는 계정
        mockMvc.perform(json(post("/api/admin/gardens"), newGarden(kim, "새 정원", "100", "null", BOUNDARY, POLYGON)
                .replace("\"customerId\":" + kim.getId(), "\"customerId\":999999")))
                .andExpect(status().isNotFound());
        assertThat(gardenRepository.count()).isEqualTo(1);
    }

    @Test
    void listsAndEditsGarden() throws Exception {
        Garden garden = garden(kim, "장미원", null);

        mockMvc.perform(get("/api/admin/gardens").cookie(adminCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("장미원"))
                .andExpect(jsonPath("$[0].customerId").value(kim.getId()))
                .andExpect(jsonPath("$[0].status").value("active"))
                // JSON을 글자가 아니라 구조 그대로 내보낸다.
                .andExpect(jsonPath("$[0].boundary[0].kind").value("M"))
                .andExpect(jsonPath("$[0].geojson.type").value("Polygon"));

        mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()),
                "{\"name\":\"장미원 북측\",\"area\":1200.5,\"status\":\"inactive\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("장미원 북측"))
                .andExpect(jsonPath("$.area").value(1200.5))
                .andExpect(jsonPath("$.status").value("inactive"));

        // 0과, 소수 둘째 자리로 맞추면 0이 되는 값은 같은 안내로 거절한다.
        for (String area : new String[] { "0", "0.001", "0.004", "-1" }) {
            mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()), "{\"area\":" + area + "}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value("정원 면적은 0보다 커야 합니다."));
        }
        // 맞춘 값이 0보다 크면 받는다.
        mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()), "{\"area\":0.005}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.area").value(0.01));
        mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()), "{\"name\":\" \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(json(patch("/api/admin/gardens/999999"), "{\"name\":\"x\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void editsGardenBoundary() throws Exception {
        Garden garden = garden(kim, "장미원", null);
        // 첫 꼭짓점을 옮긴 경계. GeoJSON은 첫 점과 마지막 점이 같아야 하므로 둘 다 바뀐다.
        String movedBoundary = BOUNDARY.replace("127.49812,34.92965", "127.497,34.93");
        String movedPolygon = POLYGON.replace("127.49812,34.92965", "127.497,34.93");

        mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()), """
                {"area":5100,"centerLat":34.9295,"centerLng":127.4985,"boundary":%s,"geojson":%s}"""
                .formatted(movedBoundary, movedPolygon)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.area").value(5100))
                .andExpect(jsonPath("$.centerLat").value(34.9295))
                .andExpect(jsonPath("$.centerLng").value(127.4985))
                .andExpect(jsonPath("$.boundary[0].points[0][0]").value(127.497))
                .andExpect(jsonPath("$.boundary[2].kind").value("Q"))
                .andExpect(jsonPath("$.geojson.coordinates[0][0][1]").value(34.93));

        // 위치와 경계는 넷을 함께 보내야 한다. 하나만 보내면 지도 위치와 모양이 어긋난다.
        mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()), "{\"boundary\":" + BOUNDARY + "}"))
                .andExpect(status().isBadRequest());
        // 등록할 때와 같은 검사를 거친다.
        mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()), """
                {"centerLat":34.9,"centerLng":127.4,"boundary":"M0 0","geojson":%s}""".formatted(POLYGON)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("정원 경계가 올바르지 않습니다. 지도에서 다시 그려 주세요."));
        mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()), """
                {"area":10,"centerLat":91,"centerLng":127.4,"boundary":%s,"geojson":%s}"""
                .formatted(BOUNDARY, POLYGON)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("정원 위치가 올바르지 않습니다."));

        // 거절된 요청은 아무것도 바꾸지 않는다.
        Garden saved = gardenRepository.findById(garden.getId()).orElseThrow();
        assertThat(saved.getCenterLat()).isEqualByComparingTo("34.9295");
        assertThat(saved.getArea()).isEqualByComparingTo("5100");
    }

    @Test
    void deletesGardenAndStopsWorkOnIt() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));
        Garden garden = garden(kim, "장미원", "ROVEN-01");
        Garden other = garden(kim, "초화원", "ROVEN-01");
        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-01"),
                "{\"online\":true,\"state\":\"working\",\"activeGardenId\":" + garden.getId() + "}"))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/admin/gardens/" + garden.getId()).cookie(adminCookie))
                .andExpect(status().isNoContent());

        assertThat(gardenRepository.findAll()).extracting(Garden::getId).containsExactly(other.getId());
        // 장비는 남고 하던 작업만 멈춘다. 같은 고객의 다른 정원 배정은 그대로다.
        Device device = deviceRepository.findById("ROVEN-01").orElseThrow();
        assertThat(device.getState().name()).isEqualTo("IDLE");
        assertThat(device.getActiveGardenId()).isNull();
        assertThat(gardenRepository.findById(other.getId()).orElseThrow().getDeviceId()).isEqualTo("ROVEN-01");

        mockMvc.perform(delete("/api/admin/gardens/" + garden.getId()).cookie(adminCookie))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/admin/gardens/" + other.getId()).cookie(loginCookie("kim@example.com")))
                .andExpect(status().isForbidden());
        assertThat(gardenRepository.count()).isEqualTo(1);
    }

    @Test
    void rejectsSameNameForSameOwner() throws Exception {
        garden(kim, "장미원", null);
        Garden other = garden(kim, "초화원", null);

        mockMvc.perform(json(patch("/api/admin/gardens/" + other.getId()), "{\"name\":\"장미원\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("이 고객에게 같은 이름의 정원이 있습니다."));
    }

    @Test
    void deviceServesOnlyOneOwner() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));
        Garden kimGarden = garden(kim, "장미원", null);
        Garden kimSecond = garden(kim, "초화원", null);
        Garden jungGarden = garden(jung, "바람정원", null);

        // 같은 고객의 정원 여러 곳은 한 장비가 맡을 수 있다.
        assign(kimGarden, "\"ROVEN-01\"").andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceId").value("ROVEN-01"));
        assign(kimSecond, "\"ROVEN-01\"").andExpect(status().isOk());
        // 다른 고객의 정원은 맡을 수 없다.
        assign(jungGarden, "\"ROVEN-01\"").andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("다른 고객의 정원을 맡고 있는 장비입니다."));
        assign(kimGarden, "\"ROVEN-99\"").andExpect(status().isNotFound());

        // null로 보내면 배정을 푼다.
        assign(kimGarden, "null").andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceId").doesNotExist());
    }

    @Test
    void changingOwnerOrDeviceStopsWork() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));
        Garden garden = garden(kim, "장미원", "ROVEN-01");
        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-01"),
                "{\"online\":true,\"state\":\"working\",\"activeGardenId\":\"" + garden.getId() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeGardenId").value(garden.getId()));

        // 주인을 바꾸면 장비 배정이 풀리고, 하던 작업도 멈춘다.
        mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()),
                "{\"customerId\":\"" + jung.getId() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerId").value(jung.getId()))
                .andExpect(jsonPath("$.deviceId").doesNotExist());

        Device device = deviceRepository.findById("ROVEN-01").orElseThrow();
        assertThat(device.getState().name()).isEqualTo("IDLE");
        assertThat(device.getActiveGardenId()).isNull();
    }

    @Test
    void activeGardenMustBeServedByTheDevice() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));
        Garden garden = garden(kim, "장미원", null);

        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-01"),
                "{\"activeGardenId\":\"" + garden.getId() + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("이 장비가 맡은 정원이 아닙니다."));
    }

    @Test
    void releaseTakesDeviceOutOfAllGardens() throws Exception {
        deviceRepository.save(new Device("ROVEN-01", "RV-0001", "1.4.2"));
        Garden first = garden(kim, "장미원", "ROVEN-01");
        Garden second = garden(kim, "초화원", "ROVEN-01");
        mockMvc.perform(json(patch("/api/admin/devices/ROVEN-01"),
                "{\"online\":true,\"state\":\"working\",\"activeGardenId\":" + first.getId() + "}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/admin/devices/ROVEN-01/release").cookie(adminCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("idle"))
                .andExpect(jsonPath("$.activeGardenId").doesNotExist());

        assertThat(gardenRepository.findById(first.getId()).orElseThrow().getDeviceId()).isNull();
        assertThat(gardenRepository.findById(second.getId()).orElseThrow().getDeviceId()).isNull();
    }

    private org.springframework.test.web.servlet.ResultActions assign(Garden garden, String deviceIdJson)
            throws Exception {
        return mockMvc.perform(json(patch("/api/admin/gardens/" + garden.getId()),
                "{\"deviceId\":" + deviceIdJson + "}"));
    }

    private User user(String email, UserRole role, String name) {
        return userRepository.save(new User(email, passwordEncoder.encode(PASSWORD), role, name, ""));
    }

    private Garden garden(User owner, String name, String deviceId) {
        return gardenRepository.save(new Garden(owner.getId(), name, "전라남도 순천시 국가정원1호길 47", "장미",
                new BigDecimal("4820.00"), deviceId, new BigDecimal("34.9292300"), new BigDecimal("127.4988900"),
                "[{\"kind\":\"M\",\"points\":[[127.49812,34.92965]]},{\"kind\":\"Z\",\"points\":[]}]",
                "{\"type\":\"Polygon\",\"coordinates\":[[[127.49812,34.92965],[127.49889,34.9299],"
                        + "[127.49826,34.92855],[127.49812,34.92965]]]}"));
    }

    // 관리자 쿠키와 JSON 본문을 붙인다.
    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.cookie(adminCookie).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private Cookie loginCookie(String email) throws Exception {
        Cookie cookie = mockMvc.perform(login(email, PASSWORD))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie(AuthCookies.NAME);
        assertThat(cookie).isNotNull();
        return cookie;
    }

    private static MockHttpServletRequestBuilder login(String email, String password) {
        return post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }
}
