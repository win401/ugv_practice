package com.tbcrew.saemgil.device;

// 관리자가 장비를 등록할 때 보내는 값. 장비 번호(ROVEN-01)는 서버가 붙인다.
public record RegisterDeviceRequest(String serial, String firmware) {
}
