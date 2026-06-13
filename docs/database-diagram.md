# Synapse Database Diagram

This diagram captures the first-pass relational model for Synapse as described in the project proposal. The core idea is that courses, assignments, grades, topics, and prerequisites form an academic graph that later AI features can query and summarize.

```mermaid
erDiagram
    USER ||--o{ SEMESTER : owns
    USER ||--o{ COURSE : owns
    USER ||--o{ STUDY_SESSION : tracks
    USER ||--o{ WEEKLY_DIGEST : receives

    SEMESTER ||--o{ COURSE : contains

    COURSE ||--o{ ASSIGNMENT : has
    COURSE ||--o{ TOPIC : covers
    COURSE ||--o{ STUDY_SESSION : studied_for
    COURSE ||--o{ SYLLABUS_IMPORT : imported_from

    ASSIGNMENT ||--o{ GRADE : records

    COURSE ||--o{ PREREQUISITE : source_course
    COURSE ||--o{ PREREQUISITE : target_course

    USER {
        uuid id PK
        text email
        text name
        timestamp created_at
        timestamp updated_at
    }

    SEMESTER {
        uuid id PK
        uuid user_id FK
        text name
        int year
        text term
        date starts_on
        date ends_on
    }

    COURSE {
        uuid id PK
        uuid user_id FK
        uuid semester_id FK
        text code
        text name
        text instructor
        numeric credits
        text syllabus_text
        timestamp created_at
        timestamp updated_at
    }

    ASSIGNMENT {
        uuid id PK
        uuid course_id FK
        text name
        text category
        numeric weight
        date due_date
        numeric max_score
        numeric actual_score
        text status
        timestamp created_at
        timestamp updated_at
    }

    GRADE {
        uuid id PK
        uuid assignment_id FK
        numeric score
        text letter_grade
        timestamp date_entered
    }

    TOPIC {
        uuid id PK
        uuid course_id FK
        text name
        text description
        numeric confidence
    }

    PREREQUISITE {
        uuid id PK
        uuid source_course_id FK
        uuid target_course_id FK
        text relationship_type
        text source
        numeric confidence
    }

    STUDY_SESSION {
        uuid id PK
        uuid user_id FK
        uuid course_id FK
        text topic
        int duration_minutes
        timestamp started_at
        timestamp ended_at
    }

    SYLLABUS_IMPORT {
        uuid id PK
        uuid course_id FK
        text file_name
        text raw_text
        json extracted_data
        text status
        timestamp created_at
    }

    WEEKLY_DIGEST {
        uuid id PK
        uuid user_id FK
        date week_start
        date week_end
        text summary
        json workload_snapshot
        json grade_snapshot
        timestamp created_at
    }
```

## Implementation Notes

- `course` is the central academic unit.
- `assignment` stores both deadlines and grading weights.
- `grade` preserves score history for trend analysis.
- `topic` and `prerequisite` form the academic graph.
- `syllabus_import` stores raw and structured extraction output for review and re-processing.
- `study_session` and `weekly_digest` support later workload forecasting and personalized summaries.
