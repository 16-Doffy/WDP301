# Entity-Relationship Diagram — Data Labeling Platform (LabelFlow)

> **Loại trừ:** Reward, UserScore, Warning (đã xóa hoặc không liên quan)

---

## Mermaid ER Diagram

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string username UK
        string email UK
        string password
        string role "admin | manager | annotator | reviewer"
        string fullName
        string specialty
        boolean isActive
        Date createdAt
    }

    PROJECT {
        ObjectId _id PK
        string name
        string description
        ObjectId managerId FK "→ User"
        array questions
        string guidelines
        object reviewPolicy
        string status "draft | active | in_review | waiting_rework | finalizing | completed | archived"
        Date deadline
        string exportFormat "JSON | YOLO | VOC | COCO | CSV"
        number totalTasks
        number reviewedTasks
        object projectReview
        Date createdAt
        Date updatedAt
    }

    DATASET {
        ObjectId _id PK
        string type "image | text | audio"
        ObjectId projectId FK "→ Project"
        ObjectId subtopicId FK "→ Subtopic"
        array subtopicIds FK "→ Subtopic[]"
        ObjectId managerId FK "→ User"
        string name
        string description
        array files
        number totalItems
        number imageCount
        array labelsets FK "→ LabelSet[]"
        string status "draft | labeling | review | completed"
        Date updatedAt
        Date createdAt
    }

    TASK {
        ObjectId _id PK
        ObjectId projectId FK "→ Project"
        ObjectId datasetId FK "→ Dataset"
        ObjectId subtopicId FK "→ Subtopic"
        ObjectId annotatorId FK "→ User"
        object dataItem
        string status "assigned | in_progress | completed | submitted | approved | rejected | revised"
        mixed labels
        array availableLabels
        array annotatorLabels
        mixed consensusLabel
        number consensusScore
        object consensusMeta
        Date submittedAt
        Date reviewedAt
        ObjectId reviewerId FK "→ User"
        array reviewers
        array reviewNotes
        string reviewComments
        string errorCategory
        array reviewIssues
        Date createdAt
        Date updatedAt
    }

    TOPIC {
        ObjectId _id PK
        string name
        string description
        ObjectId managerId FK "→ User"
        string color
        string icon
        string status "active | archived"
        number order
        Date createdAt
        Date updatedAt
    }

    SUBTOPIC {
        ObjectId _id PK
        string name
        string description
        ObjectId topicId FK "→ Topic"
        ObjectId managerId FK "→ User"
        ObjectId parentSubtopicId FK "→ Subtopic (self)"
        string guideline
        string taskType "classification | bbox | ner | sentiment | multi_label"
        string status "active | archived"
        number order
        array assets
        Date createdAt
        Date updatedAt
    }

    LABELSET {
        ObjectId _id PK
        ObjectId subtopicId FK "→ Subtopic"
        ObjectId managerId FK "→ User"
        string name
        array labels
        boolean allowMultiple
        boolean required
        Date createdAt
        Date updatedAt
    }

    ACTIVITYLOG {
        ObjectId _id PK
        ObjectId userId FK "→ User"
        string action
        string resourceType
        ObjectId resourceId
        string description
        mixed metadata
        string ipAddress
        string userAgent
        Date createdAt
    }

    SYSTEMSETTINGS {
        ObjectId _id PK
        object email
        object storage
        object tasks
        object review
        object general
        object notifications
        Date updatedAt
        ObjectId updatedBy FK "→ User"
    }

    %% ========================================================
    %% RELATIONSHIPS
    %% ========================================================

    %% User quản lý nhiều Project
    USER ||--o{ PROJECT : "quản lý"

    %% User quản lý nhiều Dataset
    USER ||--o{ DATASET : "quản lý"

    %% User gán nhãn nhiều Task
    USER ||--o{ TASK : "gán nhãn (annotator)"

    %% User duyệt nhiều Task
    USER ||--o{ TASK : "duyệt (reviewer)"

    %% User quản lý nhiều Topic
    USER ||--o{ TOPIC : "quản lý"

    %% User quản lý nhiều Subtopic
    USER ||--o{ SUBTOPIC : "quản lý"

    %% User quản lý nhiều LabelSet
    USER ||--o{ LABELSET : "quản lý"

    %% User cập nhật SystemSettings
    USER ||--o| SYSTEMSETTINGS : "cập nhật cài đặt"

    %% User ghi ActivityLog
    USER ||--o{ ACTIVITYLOG : "ghi log"

    %% Project chứa nhiều Dataset
    PROJECT ||--o{ DATASET : "chứa"

    %% Project tạo nhiều Task
    PROJECT ||--o{ TASK : "tạo tác vụ"

    %% Dataset chứa nhiều Task
    DATASET ||--o{ TASK : "tạo tác vụ"

    %% Topic chứa nhiều Subtopic
    TOPIC ||--o{ SUBTOPIC : "chứa"

    %% Subtopic có Subtopic cha (self-ref)
    SUBTOPIC ||--o| SUBTOPIC : "sub-subtopic (nested)"

    %% Subtopic chứa nhiều LabelSet
    SUBTOPIC ||--o{ LABELSET : "định nghĩa nhãn"

    %% Dataset ↔ Subtopic (nhiều-nhiều)
    DATASET }o--o{ SUBTOPIC : "gán vào"

    %% Dataset dùng nhiều LabelSet
    DATASET }o--o{ LABELSET : "sử dụng"

    %% Task thuộc Subtopic
    TASK }o--|| SUBTOPIC : "thuộc về"
```

---

## Taxonomic Hierarchy (Cấu trúc phân cấp)

```
Topic
  └── Subtopic (nested: parentSubtopicId self-reference)
        ├── LabelSet
        │     └── Label { name, color, description, shortcut }
        └── Assets (files: image/audio/text)
              └── Dataset
                    └── Project
                          └── Task
                                ├── Annotator (User)
                                │     └── gán nhãn → labels
                                └── Reviewer (User)
                                      └── duyệt → approved/rejected/revised
```

---

## Label Resolution Chain

```
Dataset.subtopicIds
  → Subtopic
      → LabelSet (linked)
          → Label[] → dùng trong Task.labels
```

---

## Task Status Flow

```
assigned
  → in_progress (annotator đang làm)
  → completed (annotator xong nhưng chưa nộp)
  → submitted (annotator nộp cho reviewer)
  → approved (reviewer duyệt) ✅
  → rejected (reviewer từ chối) → annotator sửa
  → revised (annotator sửa xong nộp lại)
  → approved / rejected (reviewer duyệt lại)
```

---

## Review Voting Flow (Multi-reviewer)

```
Task (1 item)
  ├── reviewers[] = [{ reviewerId, status: 'pending'|'approved'|'rejected' }]
  ├── annotatorLabels[] = [{ annotatorId, labels, submittedAt }]
  ├── consensusLabel     = kết quả cuối cùng
  └── consensusScore     = 0–1
```

---

## API Endpoints chính

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/tasks/my-tasks` | Tasks theo role |
| POST | `/api/tasks/:id/submit` | Annotator nộp task |
| POST | `/api/reviews/:id/approve` | Reviewer duyệt |
| POST | `/api/reviews/:id/reject` | Reviewer từ chối |
| GET | `/api/datasets/:id/final-export` | Export approved items |
| GET | `/api/projects/:id/export` | Export theo project |
| GET | `/api/reviews/pending` | Queue review |
| GET | `/api/reviews/projects/:id/subtopics` | Review breakdown |
| GET | `/api/topics` | Taxonomy |
