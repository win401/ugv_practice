package com.ugv.practice;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.ResultSet;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class TodoController {
    private final JdbcTemplate jdbc;

    TodoController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    record Todo(int id, String title, boolean done) {}
    record TodoRequest(String title, Boolean done) {}

    @GetMapping("/")
    Map<String, String> hello() { return Map.of("message", "hello"); }

    @GetMapping("/todos")
    List<Todo> list() {
        return jdbc.query("SELECT id, title, done FROM todos ORDER BY id",
            (row, index) -> new Todo(row.getInt("id"), row.getString("title"), row.getBoolean("done")));
    }

    @GetMapping("/todos/{id}")
    Todo get(@PathVariable int id) {
        return jdbc.query("SELECT id, title, done FROM todos WHERE id = ?",
            (row, index) -> new Todo(row.getInt("id"), row.getString("title"), row.getBoolean("done")), id)
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "todo not found"));
    }

    @PostMapping("/todos")
    @ResponseStatus(HttpStatus.CREATED)
    Todo create(@RequestBody TodoRequest request) {
        if (request.title() == null) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "title is required");
        boolean done = Boolean.TRUE.equals(request.done());
        Integer id = jdbc.execute((ConnectionCallback<Integer>) connection -> {
            boolean sqlite = connection.getMetaData().getURL().startsWith("jdbc:sqlite:");
            try (PreparedStatement statement = sqlite
                    ? connection.prepareStatement("INSERT INTO todos (title, done) VALUES (?, ?)")
                    : connection.prepareStatement("INSERT INTO todos (title, done) VALUES (?, ?)", Statement.RETURN_GENERATED_KEYS)) {
                statement.setString(1, request.title());
                statement.setBoolean(2, done);
                statement.executeUpdate();
                try (ResultSet keys = sqlite
                        ? connection.createStatement().executeQuery("SELECT last_insert_rowid()")
                        : statement.getGeneratedKeys()) {
                    if (!keys.next()) throw new IllegalStateException("Todo ID was not generated");
                    return keys.getInt(1);
                }
            }
        });
        return new Todo(id, request.title(), done);
    }

    @ExceptionHandler(ResponseStatusException.class)
    org.springframework.http.ResponseEntity<Map<String, String>> error(ResponseStatusException exception) {
        return org.springframework.http.ResponseEntity.status(exception.getStatusCode()).body(Map.of("detail", exception.getReason()));
    }
}
