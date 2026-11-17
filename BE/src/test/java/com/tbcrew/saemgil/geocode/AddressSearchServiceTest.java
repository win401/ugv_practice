package com.tbcrew.saemgil.geocode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.json.JsonMapper;

// V-world 응답을 화면에 줄 모양으로 바꾸는 부분만 확인한다. 실제 V-world는 부르지 않는다.
class AddressSearchServiceTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @Test
    void readsPlaceAndAddressItems() {
        List<AddressResult> results = AddressSearchService.parse(jsonMapper.readTree("""
                {"response":{"status":"OK","result":{"items":[
                  {"title":"순천만국가정원","address":{"road":"전라남도 순천시 국가정원1호길 47","parcel":"오천동 600"},
                   "point":{"x":"127.5099","y":"34.9297"}},
                  {"address":{"road":"","parcel":"전라남도 순천시 오천동 600","bldnm":""},
                   "point":{"x":"127.5","y":"34.93"}},
                  {"title":"좌표 없음","address":{"road":"어딘가"},"point":{}}
                ]}}}"""));

        assertThat(results).hasSize(2);
        assertThat(results.get(0)).isEqualTo(
                new AddressResult("순천만국가정원", "전라남도 순천시 국가정원1호길 47", 34.9297, 127.5099));
        // 이름이 없으면 주소를, 도로명이 없으면 지번을 쓴다.
        assertThat(results.get(1).title()).isEqualTo("전라남도 순천시 오천동 600");
    }

    @Test
    void noResultIsEmptyAndErrorIsRejected() {
        assertThat(AddressSearchService.parse(jsonMapper.readTree("""
                {"response":{"status":"NOT_FOUND"}}"""))).isEmpty();
        assertThatThrownBy(() -> AddressSearchService.parse(jsonMapper.readTree("""
                {"response":{"status":"ERROR","error":{"code":"INVALID_KEY"}}}""")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rejectsShortQueryAndMissingKey() {
        AddressSearchService withoutKey = new AddressSearchService(" ", jsonMapper);

        assertThatThrownBy(() -> withoutKey.search("가"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("검색어를 2~100자로");
        assertThatThrownBy(() -> withoutKey.search("순천만국가정원"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("주소 검색이 설정되지 않았습니다");
    }
}
