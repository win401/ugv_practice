package com.ugv.practice;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.sqlite.url=jdbc:sqlite::memory:")
@AutoConfigureMockMvc
class TodoControllerTest {
    @Autowired MockMvc client;

    @Test
    void rootAndList() throws Exception {
        client.perform(get("/")).andExpect(status().isOk()).andExpect(jsonPath("$.message").value("hello"));
        client.perform(get("/todos")).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").exists());
    }

    @Test
    void createAndRetrieve() throws Exception {
        String response = client.perform(post("/todos").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"test\",\"done\":true}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.done").value(true))
            .andReturn().getResponse().getContentAsString();
        int id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("id").asInt();
        client.perform(get("/todos/" + id)).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("test"));
    }

    @Test
    void missingTodo() throws Exception {
        client.perform(get("/todos/99999999")).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.detail").value("todo not found"));
    }
}
