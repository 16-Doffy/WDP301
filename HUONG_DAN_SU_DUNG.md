# Hướng Dẫn Sử Dụng - Data Labeling Support System

## 1. Khởi động hệ thống

### Backend
```bash
cd backend
npm install
npm run seed  # Tạo tài khoản mẫu (chỉ chạy lần đầu)
npm start     # hoặc npm run dev để chạy với nodemon
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## 2. Đăng nhập

Mở trình duyệt và truy cập: `http://localhost:3000`

Sử dụng một trong các tài khoản mẫu (xem file `TAI_KHOAN_MAU.md`)

## 3. Quy trình làm việc theo từng role

### 👑 ADMIN

**Trang chủ:** `/admin`

**Chức năng:**
- Xem dashboard với thống kê tổng quan
- Quản lý Users (`/admin/users`):
  - Xem danh sách tất cả users
  - Thay đổi role của user
  - Kích hoạt/vô hiệu hóa user

**Ví dụ sử dụng:**
1. Đăng nhập với `admin@example.com` / `admin123`
2. Vào "Users" từ menu
3. Chọn user cần chỉnh sửa
4. Thay đổi role hoặc toggle Active/Inactive

---

### 📋 MANAGER

**Trang chủ:** `/dashboard`

**Chức năng chính:**

#### 3.1. Tạo Project mới
1. Vào "Projects" từ menu
2. Click "New Project"
3. Điền thông tin:
   - **Project Name:** Tên dự án (VD: "Object Detection Dataset")
   - **Description:** Mô tả ngắn
   - **Guidelines:** Hướng dẫn chi tiết cho annotators
   - **Label Set:** Danh sách nhãn (có thể thêm sau)
4. Click "Create"

#### 3.2. Upload Dataset
1. Vào project detail (click vào project)
2. Click "Upload" trong phần Datasets
3. Chọn tên dataset
4. Chọn các file cần upload (ảnh, video, v.v.)
5. Click "Upload"

#### 3.3. Phân công Tasks cho Annotators
1. Trong project detail, click "Assign" ở dataset
2. Chọn dataset cần phân công
3. Chọn một hoặc nhiều annotators
4. Click "Assign"
5. Hệ thống tự động tạo tasks cho mỗi file × mỗi annotator

#### 3.4. Theo dõi tiến độ
- Xem "Tasks Overview" trong project detail
- Thống kê: Total, Assigned, In Progress, Submitted, Approved

**Ví dụ workflow:**
```
1. Tạo project "Car Detection"
2. Upload 10 ảnh xe hơi
3. Phân công cho annotator1 và annotator2
   → Tạo ra 20 tasks (10 ảnh × 2 annotators)
4. Theo dõi tiến độ gán nhãn
```

---

### ✏️ ANNOTATOR

**Trang chủ:** `/annotator/tasks`

**Chức năng chính:**

#### 3.1. Xem danh sách tasks
- Vào "My Tasks" từ menu
- Xem tất cả tasks được phân công
- Status: Assigned, In Progress, Submitted, Approved, Rejected

#### 3.2. Gán nhãn
1. Click vào task cần làm
2. Xem:
   - Project name và guidelines
   - File cần gán nhãn (hiển thị ảnh nếu là image)
3. Gán nhãn theo format JSON:
   ```json
   {
     "objects": [
       {
         "label": "Person",
         "bbox": [100, 150, 200, 300],
         "confidence": 0.95
       },
       {
         "label": "Car",
         "bbox": [300, 200, 500, 400],
         "confidence": 0.88
       }
     ]
   }
   ```
4. Click "Save" để lưu tạm
5. Click "Submit for Review" khi hoàn thành

#### 3.3. Xử lý feedback từ Reviewer
- Nếu bị reject, sẽ thấy "Review Comments"
- Đọc comments và chỉnh sửa labels
- Submit lại

**Ví dụ workflow:**
```
1. Xem task "sample1.jpg" từ project "Car Detection"
2. Mở ảnh và xác định các đối tượng
3. Gán nhãn: Person ở vị trí [100, 150, 200, 300]
4. Save → Submit for Review
5. Chờ reviewer phê duyệt
```

---

### ✅ REVIEWER

**Trang chủ:** `/reviewer/tasks`

**Chức năng chính:**

#### 3.1. Xem danh sách tasks cần review
- Vào "Reviews" từ menu
- Chỉ hiển thị tasks có status = "submitted"
- Sắp xếp theo thời gian submit

#### 3.2. Review task
1. Click vào task cần review
2. Xem:
   - Project guidelines
   - Annotator đã gán nhãn
   - File gốc
   - Labels đã được gán (format JSON)
3. So sánh labels với guidelines
4. Quyết định:
   - **Approve:** Click "Approve" → Task chuyển sang "approved"
   - **Reject:** 
     - Điền "Review Comments" (bắt buộc)
     - Chọn "Error Category" (tùy chọn)
     - Click "Reject" → Task chuyển sang "rejected", annotator sẽ thấy feedback

**Error Categories:**
- Incorrect Label: Nhãn sai
- Missing Label: Thiếu nhãn
- Poor Quality: Chất lượng kém
- Other: Khác

**Ví dụ workflow:**
```
1. Xem task từ annotator1 đã submit
2. Kiểm tra labels: có 2 objects (Person, Car)
3. So sánh với guidelines → Đúng
4. Click "Approve"
5. Task chuyển sang "approved"
```

---

## 4. Ví dụ form gán nhãn (Annotator)

### Format JSON cho Object Detection:
```json
{
  "objects": [
    {
      "label": "Person",
      "bbox": [x1, y1, x2, y2],
      "confidence": 0.95
    }
  ]
}
```

### Format JSON cho Classification:
```json
{
  "category": "Car",
  "confidence": 0.88
}
```

### Format JSON cho Segmentation:
```json
{
  "regions": [
    {
      "label": "Person",
      "points": [[x1, y1], [x2, y2], ...],
      "type": "polygon"
    }
  ]
}
```

## 5. Lưu ý quan trọng

### Bảo mật
- Không chia sẻ mật khẩu
- Đổi mật khẩu định kỳ
- Logout sau khi sử dụng

### Chất lượng gán nhãn
- Đọc kỹ guidelines trước khi gán nhãn
- Đảm bảo tính nhất quán
- Hỏi manager nếu không rõ

### Quy trình
- Annotator: Save thường xuyên để tránh mất dữ liệu
- Reviewer: Review kỹ trước khi approve
- Manager: Theo dõi tiến độ và chất lượng thường xuyên

## 6. Troubleshooting

### Lỗi đăng nhập
- Kiểm tra email và password
- Đảm bảo tài khoản đang active (Admin có thể kiểm tra)

### Không thấy tasks
- Kiểm tra xem đã được phân công chưa (Manager)
- Kiểm tra status của task

### Lỗi upload file
- Kiểm tra kích thước file (max 50MB)
- Kiểm tra định dạng file được hỗ trợ

### Lỗi hiển thị ảnh
- Kiểm tra đường dẫn file
- Đảm bảo file đã được upload đúng

## 7. Liên hệ hỗ trợ

Nếu gặp vấn đề, liên hệ Admin hoặc Manager để được hỗ trợ.
