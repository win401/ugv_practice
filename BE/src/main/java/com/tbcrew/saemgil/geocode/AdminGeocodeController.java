package com.tbcrew.saemgil.geocode;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

// 정원 등록 화면의 주소 검색. /api/admin/** 은 SecurityConfig에서 관리자만 통과한다.
@RestController
@RequestMapping("/api/admin/geocode")
@RequiredArgsConstructor
public class AdminGeocodeController {

    private final AddressSearchService addressSearchService;

    @GetMapping
    public List<AddressResult> search(@RequestParam(defaultValue = "") String query) {
        return addressSearchService.search(query);
    }
}
