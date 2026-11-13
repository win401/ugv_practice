package com.ugv.practice;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.sqlite.url=jdbc:sqlite::memory:")
@AutoConfigureMockMvc
class DeviceStatusControllerTest {
    @Autowired MockMvc client;

    @Test
    void statusIsUnknownWithoutObservations() throws Exception {
        client.perform(get("/devices/UGV-01/status"))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"device_id\":\"UGV-01\",\"status\":\"unknown\",\"checked_at\":null}", true));
    }

    @Test
    void unsupportedDeviceReturns404() throws Exception {
        client.perform(get("/devices/UGV-02/status"))
            .andExpect(status().isNotFound())
            .andExpect(content().json("{\"detail\":\"device not found\"}", true));
    }
}
