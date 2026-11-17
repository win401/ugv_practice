package com.tbcrew.saemgil.dashboard;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.tbcrew.saemgil.dashboard.DashboardResponse.Customer;
import com.tbcrew.saemgil.dashboard.DashboardResponse.ViewAs;
import com.tbcrew.saemgil.device.DeviceRepository;
import com.tbcrew.saemgil.device.DeviceResponse;
import com.tbcrew.saemgil.garden.Garden;
import com.tbcrew.saemgil.garden.GardenRepository;
import com.tbcrew.saemgil.garden.GardenResponse;
import com.tbcrew.saemgil.garden.GardenStatus;
import com.tbcrew.saemgil.user.User;
import com.tbcrew.saemgil.user.UserRepository;
import com.tbcrew.saemgil.user.UserResponse;
import com.tbcrew.saemgil.user.UserRole;

import lombok.RequiredArgsConstructor;

// 운영 화면의 첫 조회: 내 정원과 그 정원에 배정된 장비.
// 운영자는 자기 정원만 본다. 관리자는 처음에 자기 정원을 보고, 정원이 있는 운영자를 골라 그 화면도 볼 수 있다.
// 비활성 정원은 운영 화면에 보이지 않는다.
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final UserRepository userRepository;
    private final GardenRepository gardenRepository;
    private final DeviceRepository deviceRepository;

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(Long userId, Long customerId) {
        User user = userRepository.findById(userId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));

        ViewAs viewAs = null;
        Long ownerId = user.getId();
        if (user.getRole() == UserRole.ADMIN) {
            List<Customer> customers = new ArrayList<>();
            customers.add(new Customer(user.getId(), user.getName() + " (내 정원)"));
            userRepository.findAll(Sort.by("id")).stream()
                    .filter(other -> other.getRole() == UserRole.OPERATOR && !visibleGardens(other.getId()).isEmpty())
                    .forEach(other -> customers.add(new Customer(other.getId(), other.getName())));
            // 고를 수 없는 계정을 요청하면 자기 정원을 보여 준다.
            boolean selectable = customers.stream().anyMatch(customer -> customer.id().equals(customerId));
            ownerId = selectable ? customerId : user.getId();
            viewAs = new ViewAs(ownerId, customers);
        }

        List<Garden> gardens = visibleGardens(ownerId);
        List<String> deviceIds = gardens.stream().map(Garden::getDeviceId).filter(Objects::nonNull).distinct().toList();
        return new DashboardResponse(
                UserResponse.from(user),
                gardens.stream().map(GardenResponse::from).toList(),
                deviceRepository.findAllById(deviceIds).stream().map(DeviceResponse::from).toList(),
                List.of(),
                viewAs);
    }

    // 최근에 등록한 정원이 먼저 온다. 운영 화면은 목록의 첫 정원을 처음에 보여 준다.
    private List<Garden> visibleGardens(Long ownerId) {
        return gardenRepository.findByOwnerId(ownerId).stream()
                .filter(garden -> garden.getStatus() != GardenStatus.INACTIVE)
                .sorted(Comparator.comparing(Garden::getId).reversed())
                .toList();
    }
}
