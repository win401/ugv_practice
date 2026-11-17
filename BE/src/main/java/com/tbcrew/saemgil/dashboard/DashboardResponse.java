package com.tbcrew.saemgil.dashboard;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.tbcrew.saemgil.device.DeviceResponse;
import com.tbcrew.saemgil.garden.GardenResponse;
import com.tbcrew.saemgil.user.UserResponse;

// 운영 화면에 필요한 값. FE의 OperatorDashboard 타입(FE/src/api/types.ts)에 맞춘다.
// records(작업 기록)는 장비 연동 때 생기므로 지금은 항상 비어 있다.
// viewAs는 관리자가 볼 때만 있다: 지금 보고 있는 계정과 고를 수 있는 계정 목록.
public record DashboardResponse(
        UserResponse user,
        List<GardenResponse> gardens,
        List<DeviceResponse> devices,
        List<Object> records,
        @JsonInclude(JsonInclude.Include.NON_NULL) ViewAs viewAs) {

    public record ViewAs(Long customerId, List<Customer> customers) {
    }

    public record Customer(Long id, String name) {
    }
}
