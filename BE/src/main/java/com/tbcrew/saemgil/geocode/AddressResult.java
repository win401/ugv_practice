package com.tbcrew.saemgil.geocode;

// 주소 검색 결과 한 건. title은 장소 이름(없으면 주소), 좌표는 WGS84다.
public record AddressResult(String title, String address, double lat, double lng) {
}
