package com.ugv.practice;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
public class PracticeApplication {
    public static void main(String[] args) {
        SpringApplication.run(PracticeApplication.class, args);
    }

    @Bean
    DataSource dataSource(@Value("${app.sqlite.url:jdbc:sqlite:./local.db}") String sqliteUrl) {
        HikariDataSource dataSource = new HikariDataSource();
        String instance = System.getenv("INSTANCE_CONNECTION_NAME");
        if (instance == null || instance.isBlank()) {
            dataSource.setJdbcUrl(sqliteUrl);
            dataSource.setMaximumPoolSize(1);
        } else {
            dataSource.setJdbcUrl("jdbc:mysql:///" + System.getenv("DB_NAME"));
            dataSource.setUsername(System.getenv("DB_USER"));
            dataSource.setPassword(System.getenv("DB_PASS"));
            dataSource.addDataSourceProperty("socketFactory", "com.google.cloud.sql.mysql.SocketFactory");
            dataSource.addDataSourceProperty("cloudSqlInstance", instance);
            dataSource.addDataSourceProperty("cloudSqlRefreshStrategy", "lazy");
        }
        return dataSource;
    }

    @Bean
    CommandLineRunner initialize(JdbcTemplate jdbc) {
        return args -> {
            boolean mysql = System.getenv("INSTANCE_CONNECTION_NAME") != null && !System.getenv("INSTANCE_CONNECTION_NAME").isBlank();
            String id = mysql ? "INTEGER PRIMARY KEY AUTO_INCREMENT" : "INTEGER PRIMARY KEY AUTOINCREMENT";
            jdbc.execute("CREATE TABLE IF NOT EXISTS todos (id " + id + ", title VARCHAR(200) NOT NULL, done BOOLEAN NOT NULL)");
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM todos", Integer.class);
            if (count != null && count == 0) {
                jdbc.update("INSERT INTO todos (title, done) VALUES (?, ?)", "FastAPI", false);
                jdbc.update("INSERT INTO todos (title, done) VALUES (?, ?)", "Cloud Run", false);
                jdbc.update("INSERT INTO todos (title, done) VALUES (?, ?)", "Git Hub", true);
            }
        };
    }

    @Bean
    WebMvcConfigurer cors() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**").allowedOrigins(
                    "https://toy-web-s5xoza2y4a-uc.a.run.app",
                    "https://toy-web-831158706452.us-central1.run.app",
                    "http://localhost:5173").allowedMethods("*").allowedHeaders("*");
            }
        };
    }
}
