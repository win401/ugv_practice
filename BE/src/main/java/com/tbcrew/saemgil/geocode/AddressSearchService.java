package com.tbcrew.saemgil.geocode;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// 주소·장소 검색을 V-world에 대신 물어본다.
// V-world 검색은 브라우저에서 바로 부를 수 없어서(다른 주소의 화면에서 온 요청을 허용하지 않는다) 서버를 거친다.
// 키는 주소에 담겨 나가므로 로그에 주소를 남기지 않는다.
@Service
public class AddressSearchService {

    private static final Logger log = LoggerFactory.getLogger(AddressSearchService.class);
    private static final String SEARCH_URL = "https://api.vworld.kr/req/search";
    private static final int LIMIT = 8;

    private final String apiKey;
    private final JsonMapper jsonMapper;
    private final RestClient restClient;

    public AddressSearchService(@Value("${app.vworld.api-key:}") String apiKey, JsonMapper jsonMapper) {
        this.apiKey = apiKey.trim();
        this.jsonMapper = jsonMapper;
        // V-world가 응답하지 않을 때 화면이 오래 멈추지 않도록 짧게 기다린다.
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    // 장소 이름(예: 순천만국가정원)과 도로명 주소를 함께 찾는다.
    public List<AddressResult> search(String query) {
        String keyword = query == null ? "" : query.trim();
        if (keyword.length() < 2 || keyword.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어를 2~100자로 입력해 주세요.");
        }
        if (apiKey.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "주소 검색이 설정되지 않았습니다. 지도를 직접 옮겨 위치를 찾아 주세요.");
        }
        // 같은 주소가 두 번 나오지 않게 주소를 기준으로 모은다. 순서는 넣은 순서 그대로다.
        Map<String, AddressResult> found = new LinkedHashMap<>();
        for (AddressResult result : request(keyword, "place", null)) {
            found.putIfAbsent(result.address(), result);
        }
        for (AddressResult result : request(keyword, "address", "road")) {
            found.putIfAbsent(result.address(), result);
        }
        return found.values().stream().limit(LIMIT).toList();
    }

    private List<AddressResult> request(String keyword, String type, String category) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString(SEARCH_URL)
                .queryParam("service", "search")
                .queryParam("request", "search")
                .queryParam("version", "2.0")
                .queryParam("crs", "EPSG:4326")
                .queryParam("size", LIMIT)
                .queryParam("page", 1)
                .queryParam("type", type)
                .queryParam("format", "json")
                .queryParam("errorformat", "json")
                .queryParam("key", apiKey)
                .queryParam("query", keyword);
        if (category != null) {
            builder.queryParam("category", category);
        }
        URI uri = builder.encode().build().toUri();
        try {
            return parse(jsonMapper.readTree(restClient.get().uri(uri).retrieve().body(String.class)));
        } catch (RestClientException | JacksonException e) {
            // 예외 문장에 요청 주소(키 포함)가 들어갈 수 있어 종류만 남긴다.
            log.warn("V-world 주소 검색 실패: {}", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "주소 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    // V-world 응답에서 이름·주소·좌표만 꺼낸다. 결과가 없으면(NOT_FOUND) 빈 목록이다.
    static List<AddressResult> parse(JsonNode root) {
        JsonNode response = root.path("response");
        String status = response.path("status").asString("");
        if ("NOT_FOUND".equals(status)) {
            return List.of();
        }
        if (!"OK".equals(status)) {
            log.warn("V-world 주소 검색 응답 상태: {}", status);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "주소 검색 서비스가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        List<AddressResult> results = new ArrayList<>();
        for (JsonNode item : response.path("result").path("items")) {
            JsonNode address = item.path("address");
            String road = address.path("road").asString("");
            String text = road.isBlank() ? address.path("parcel").asString("") : road;
            String title = item.path("title").asString("");
            if (title.isBlank()) {
                title = address.path("bldnm").asString("");
            }
            double lng = number(item.path("point").path("x"));
            double lat = number(item.path("point").path("y"));
            if (text.isBlank() || Double.isNaN(lat) || Double.isNaN(lng)) {
                continue;
            }
            results.add(new AddressResult(title.isBlank() ? text : title, text, lat, lng));
        }
        return results;
    }

    // V-world는 좌표를 글자로 준다("127.49").
    private static double number(JsonNode node) {
        try {
            return node.isNumber() ? node.asDouble() : Double.parseDouble(node.asString(""));
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }
}
