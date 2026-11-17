package com.tbcrew.saemgil.garden;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// gardens 테이블의 한 행. 위치와 경계는 위경도로 들고 있고, 좌표 순서는 [경도, 위도]다.
@Entity
@Table(name = "gardens")
@Getter
// JPA가 DB에서 읽어 올 때 쓰는 빈 생성자. 코드에서는 쓰지 못하게 막아 둔다.
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Garden {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 정원 주인(users.id)
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private String flower;

    // 면적(m²). 0보다 커야 한다.
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal area;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false)
    private GardenStatus status;

    // 배정된 장비(devices.id). 없으면 null
    @Column(name = "device_id")
    private String deviceId;

    @Column(name = "center_lat", nullable = false, precision = 10, scale = 7)
    private BigDecimal centerLat;

    @Column(name = "center_lng", nullable = false, precision = 10, scale = 7)
    private BigDecimal centerLng;

    // 화면에서 그린 경계 원본(직선·곡선 명령)의 JSON 문자열. 다시 편집할 때 쓴다.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String boundary;

    // 곡선을 짧은 직선으로 나눈 GeoJSON Polygon의 JSON 문자열
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String geojson;

    // 값은 DB 기본값(CURRENT_TIMESTAMP)이 채운다.
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    // 관리자가 등록한 정원은 바로 사용 중이 된다.
    public Garden(Long ownerId, String name, String address, String flower, BigDecimal area, String deviceId,
            BigDecimal centerLat, BigDecimal centerLng, String boundary, String geojson) {
        this.ownerId = ownerId;
        this.name = name;
        this.address = address;
        this.flower = flower;
        this.area = area;
        this.status = GardenStatus.ACTIVE;
        this.deviceId = deviceId;
        this.centerLat = centerLat;
        this.centerLng = centerLng;
        this.boundary = boundary;
        this.geojson = geojson;
    }

    public void changeOwner(Long ownerId) {
        this.ownerId = ownerId;
    }

    public void rename(String name) {
        this.name = name;
    }

    public void changeAddress(String address) {
        this.address = address;
    }

    public void changeFlower(String flower) {
        this.flower = flower;
    }

    public void changeArea(BigDecimal area) {
        this.area = area;
    }

    public void changeStatus(GardenStatus status) {
        this.status = status;
    }

    // 장비를 배정한다. null이면 배정을 푼다.
    public void assignDevice(String deviceId) {
        this.deviceId = deviceId;
    }

    // 위치와 경계를 함께 바꾼다. 경계 원본과 GeoJSON이 서로 다른 모양을 가리키지 않도록 넷을 한 번에 받는다.
    public void changeBoundary(BigDecimal centerLat, BigDecimal centerLng, String boundary, String geojson) {
        this.centerLat = centerLat;
        this.centerLng = centerLng;
        this.boundary = boundary;
        this.geojson = geojson;
    }
}
