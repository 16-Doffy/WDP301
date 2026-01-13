# Tài Khoản Mẫu - Data Labeling Support System

File này chứa thông tin đăng nhập cho các tài khoản mẫu đã được tạo tự động.

## Cách tạo tài khoản mẫu

Chạy lệnh sau trong thư mục `backend`:

```bash
cd backend
npm run seed
```

## Danh sách tài khoản mẫu

### 👑 ADMIN (Quản trị viên)
- **Username:** `admin`
- **Email:** `admin@example.com`
- **Password:** `admin123`
- **Chức năng:** Quản lý toàn bộ hệ thống, quản lý users, cấu hình

### 📋 MANAGER (Quản lý dự án)
- **Username:** `manager1`
- **Email:** `dung@gmail.com`
- **Password:** `123456`
- **Chức năng:** 
  - Tạo và quản lý dự án gán nhãn
  - Upload datasets
  - Phân công công việc cho annotators
  - Theo dõi tiến độ và chất lượng

### ✏️ ANNOTATOR 1 (Người gán nhãn)
- **Username:** `annotator1`
- **Email:** `third@gmail.com`
- **Password:** `123456`
- **Chức năng:**
  - Nhận và xem các task được phân công
  - Gán nhãn cho dữ liệu
  - Nộp bài để review

### ✏️ ANNOTATOR 2 (Người gán nhãn)
- **Username:** `annotator2`
- **Email:** `annotator2@example.com`
- **Password:** `annotator123`
- **Chức năng:** Tương tự Annotator 1

### ✅ REVIEWER (Người kiểm duyệt)
- **Username:** `reviewer1`
- **Email:** `tien@gmail.com`
- **Password:** `123456`
- **Chức năng:**
  - Xem danh sách tasks đã nộp
  - Kiểm tra và phê duyệt/từ chối labels
  - Ghi nhận lỗi và phản hồi

## Dữ liệu mẫu

Sau khi chạy seed, hệ thống sẽ tự động tạo:

1. **Project mẫu:** "Sample Image Labeling Project"
   - Bộ nhãn: Person, Car, Bicycle, Dog
   - Hướng dẫn gán nhãn chi tiết
   - Status: Active

2. **Dataset mẫu:** "Sample Dataset 1"
   - 3 file ảnh mẫu (sample1.jpg, sample2.jpg, sample3.jpg)

3. **Task mẫu:** 
   - 1 task đã được phân công cho annotator1
   - Status: Assigned (chờ gán nhãn)

## Quy trình sử dụng mẫu

### Bước 1: Đăng nhập với Manager
```
Email: manager@example.com
Password: manager123
```
- Vào "Projects" để xem project mẫu
- Có thể upload thêm datasets hoặc phân công tasks

### Bước 2: Đăng nhập với Annotator
```
Email: annotator1@example.com
Password: annotator123
```
- Vào "My Tasks" để xem task được phân công
- Click vào task để bắt đầu gán nhãn
- Gán nhãn và nộp bài

### Bước 3: Đăng nhập với Reviewer
```
Email: reviewer@example.com
Password: reviewer123
```
- Vào "Reviews" để xem các task đã nộp
- Xem labels và phê duyệt/từ chối

### Bước 4: Đăng nhập với Admin
```
Email: admin@example.com
Password: admin123
```
- Vào "Users" để quản lý tất cả users
- Có thể thay đổi role, kích hoạt/vô hiệu hóa users

## Lưu ý

⚠️ **Cảnh báo bảo mật:** 
- Các mật khẩu trên chỉ dùng cho môi trường development
- **KHÔNG** sử dụng các mật khẩu này trong production
- Thay đổi tất cả mật khẩu trước khi deploy

## Tạo tài khoản mới

Bạn cũng có thể tạo tài khoản mới bằng cách:
1. Đăng ký qua form Register trên frontend
2. Hoặc Admin có thể quản lý users qua trang Admin
