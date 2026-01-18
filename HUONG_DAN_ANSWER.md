# Hướng dẫn về Answer trong JSON Labels

## Cấu trúc JSON Labels

Khi Annotator khoanh vùng và gán nhãn, JSON sẽ có dạng:

```json
{
  "objects": [
    {
      "label": "T1",
      "bbox": [x1, y1, x2, y2],
      "confidence": 1,
      "answer": null  // hoặc object chứa đáp án
    }
  ]
}
```

## Answer là gì?

`answer` là đáp án mà Annotator chọn cho **câu hỏi** (questions) mà Manager đã thiết lập trong Project.

## Khi nào Answer là null?

1. **Project không có questions**: Nếu Manager chưa thêm câu hỏi vào project, `answer` sẽ luôn là `null`
2. **Annotator chưa chọn đáp án**: Nếu có questions nhưng annotator bỏ qua hoặc hủy, `answer` sẽ là `null`

## Khi nào Answer có giá trị?

Khi Project có **questions** và Annotator đã chọn đáp án, `answer` sẽ là một **object** với format:

```json
{
  "answer": {
    "0": "A",  // Đáp án cho câu hỏi thứ 1 (index 0)
    "1": "B"   // Đáp án cho câu hỏi thứ 2 (index 1)
  }
}
```

### Ví dụ cụ thể:

**Project có 2 câu hỏi:**
1. Câu hỏi 1: "Đối tượng này là gì?" - Options: A. Người, B. Xe
2. Câu hỏi 2: "Màu sắc?" - Options: A. Đỏ, B. Xanh

**Annotator khoanh vùng và chọn:**
- Label: "Person"
- Câu hỏi 1: Chọn "A" (Người)
- Câu hỏi 2: Chọn "B" (Xanh)

**JSON kết quả:**
```json
{
  "objects": [
    {
      "label": "Person",
      "bbox": [10, 20, 50, 80],
      "confidence": 1,
      "answer": {
        "0": "A",  // Câu hỏi 1: Chọn A (Người)
        "1": "B"   // Câu hỏi 2: Chọn B (Xanh)
      }
    }
  ]
}
```

## Cách Manager thiết lập Questions

1. Vào Project Detail
2. Click "Cài đặt Project"
3. Mở phần "Câu hỏi và Đáp án"
4. Thêm câu hỏi với các options A, B, C...

## Lưu ý

- Nếu `answer` là `null`, có nghĩa là:
  - Project không có questions, HOẶC
  - Annotator chưa chọn đáp án
  
- Nếu Project có questions nhưng Annotator không chọn đáp án, hệ thống sẽ **không cho phép** lưu annotation (nút "Xác nhận" sẽ bị disabled)

- `answer` là **optional** - nếu project không có questions, việc không có answer là bình thường
