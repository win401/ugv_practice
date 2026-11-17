package com.tbcrew.saemgil.mission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import com.tbcrew.saemgil.garden.Garden;
import com.tbcrew.saemgil.garden.GardenRepository;
import com.tbcrew.saemgil.garden.GardenStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

class MissionControllerTest {
    private final GardenRepository gardens = mock(GardenRepository.class);
    private final MissionRepository missions = mock(MissionRepository.class);
    private final MissionController controller = new MissionController(gardens, missions, JsonMapper.builder().build());

    @Test
    void anotherUsersGardenCannotBeRead() {
        Garden garden = mock(Garden.class);
        when(garden.getOwnerId()).thenReturn(2L);
        when(gardens.findById(10L)).thenReturn(Optional.of(garden));
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> controller.list(1L, 10L));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
        verifyNoInteractions(missions);
    }

    @Test
    void invalidEndPolicyIsRejected() {
        Garden garden = mock(Garden.class);
        when(garden.getOwnerId()).thenReturn(1L);
        when(garden.getStatus()).thenReturn(GardenStatus.ACTIVE);
        when(gardens.findByIdForUpdate(10L)).thenReturn(Optional.of(garden));
        var request = new MissionController.Request("test", List.of(new MissionController.Point("p1", "point", 10, 1.0, 2.0)), "invalid");
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> controller.create(1L, 10L, request));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verifyNoInteractions(missions);
    }
}
