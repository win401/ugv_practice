package com.tbcrew.saemgil.mission;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "missions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Mission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "garden_id", nullable = false)
    private Long gardenId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private Long version = 1L;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String points;

    @Column(name = "end_policy", length = 10)
    private String endPolicy;

    Mission(Long gardenId, String name, String points, String endPolicy) {
        this.gardenId = gardenId;
        this.name = name;
        this.points = points;
        this.endPolicy = endPolicy;
    }
}
