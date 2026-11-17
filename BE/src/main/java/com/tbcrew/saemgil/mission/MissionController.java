package com.tbcrew.saemgil.mission;

import java.util.List;
import com.tbcrew.saemgil.garden.GardenRepository;
import com.tbcrew.saemgil.garden.GardenStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/me/gardens/{gardenId}/missions")
@RequiredArgsConstructor
public class MissionController {
    private final GardenRepository gardens;
    private final MissionRepository missions;
    private final JsonMapper mapper;

    public record Point(@NotBlank @Size(max = 100) String id, @NotBlank @Size(max = 100) String name,
            @NotNull @Positive Integer seconds, @NotNull Double x, @NotNull Double y) {}
    public record Request(@NotBlank @Size(max = 100) String name,
            @NotEmpty @Size(max = 100) List<@Valid @NotNull Point> points, String endPolicy) {}
    public record Response(Long id, Long gardenId, String name, Long version, List<Point> points, String endPolicy) {}

    @GetMapping
    @Transactional(readOnly = true)
    public List<Response> list(@AuthenticationPrincipal Long userId, @PathVariable Long gardenId) {
        requireOwnedGarden(userId, gardenId);
        return missions.findByGardenIdOrderByIdAsc(gardenId).stream().map(this::response).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Response create(@AuthenticationPrincipal Long userId, @PathVariable Long gardenId,
            @Valid @RequestBody Request request) {
        var garden = gardens.findByIdForUpdate(gardenId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "정원을 찾을 수 없습니다."));
        if (!garden.getOwnerId().equals(userId) || garden.getStatus() == GardenStatus.INACTIVE) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "정원을 찾을 수 없습니다.");
        }
        if (request.endPolicy() != null && !List.of("stay", "return").contains(request.endPolicy())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "종료 정책이 올바르지 않습니다.");
        }
        if (request.points().stream().anyMatch(point -> !Double.isFinite(point.x()) || !Double.isFinite(point.y()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "좌표가 올바르지 않습니다.");
        }
        Mission mission = new Mission(gardenId, request.name().trim(), mapper.writeValueAsString(request.points()), request.endPolicy());
        return response(missions.saveAndFlush(mission));
    }

    private void requireOwnedGarden(Long userId, Long gardenId) {
        var garden = gardens.findById(gardenId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "정원을 찾을 수 없습니다."));
        if (!garden.getOwnerId().equals(userId) || garden.getStatus() == GardenStatus.INACTIVE) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "정원을 찾을 수 없습니다.");
        }
    }

    private Response response(Mission mission) {
        List<Point> points = mapper.readValue(mission.getPoints(), mapper.getTypeFactory().constructCollectionType(List.class, Point.class));
        return new Response(mission.getId(), mission.getGardenId(), mission.getName(), mission.getVersion(), points, mission.getEndPolicy());
    }
}
