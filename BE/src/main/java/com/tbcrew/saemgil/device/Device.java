package com.tbcrew.saemgil.device;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// devices 테이블의 한 행. 장비(ROVEN) 한 대다.
// 연결 여부·상태·배터리·물은 장비 연동 전까지 관리자가 넣는 값이다.
@Entity
@Table(name = "devices")
@Getter
// JPA가 DB에서 읽어 올 때 쓰는 빈 생성자. 코드에서는 쓰지 못하게 막아 둔다.
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Device {

    // 장비 번호(ROVEN-01). 등록할 때 서버가 붙인다.
    @Id
    private String id;

    @Column(nullable = false)
    private String serial;

    @Column(nullable = false)
    private String firmware;

    @Column(nullable = false)
    private boolean online;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false)
    private DeviceState state;

    // 0~100
    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(nullable = false)
    private int battery;

    // 0~100
    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(nullable = false)
    private int water;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    // 작업 중일 때 작업하는 정원(gardens.id)
    @Column(name = "active_garden_id")
    private Long activeGardenId;

    // 값은 DB 기본값(CURRENT_TIMESTAMP)이 채운다.
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    // 새로 등록한 장비는 꺼져 있는 대기 상태로 시작한다.
    public Device(String id, String serial, String firmware) {
        this.id = id;
        this.serial = serial;
        this.firmware = firmware;
        this.online = false;
        this.state = DeviceState.IDLE;
        this.battery = 100;
        this.water = 0;
    }

    public void changeFirmware(String firmware) {
        this.firmware = firmware;
    }

    public void changeOnline(boolean online) {
        this.online = online;
    }

    public void changeState(DeviceState state) {
        this.state = state;
    }

    public void changeBattery(int battery) {
        this.battery = battery;
    }

    public void changeWater(int water) {
        this.water = water;
    }

    public void changeActiveGarden(Long gardenId) {
        this.activeGardenId = gardenId;
    }

    // 장비가 값을 보낸 시각. 장비 연동 전에는 관리자가 값을 바꾼 시각이다.
    public void markSeen(LocalDateTime at) {
        this.lastSeenAt = at;
    }

    // 하던 작업을 멈추고 대기 상태로 돌린다.
    public void stopWork() {
        this.state = DeviceState.IDLE;
        this.activeGardenId = null;
    }
}
