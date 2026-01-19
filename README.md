# Team8-WDP

Hệ thống hỗ trợ gán nhãn dữ liệu phục vụ huấn luyện và đánh giá mô hình học máy.

## Công nghệ sử dụng

- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + Material-UI

## Cài đặt

### Backend

```bash
cd backend
npm install
# Tạo file .env với nội dung:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/data-labeling
# JWT_SECRET=SE161783
# NODE_ENV=development



npm start
# hoặc npm run dev để chạy với nodemon
```

### Frontend

```bash
cd frontend
npm install
npm start
```

## Tính năng

### Manager
- Quản lý dự án gán nhãn
- Quản lý bộ dữ liệu
- Thiết lập bộ nhãn và hướng dẫn gán nhãn
- Phân công công việc cho annotator
- Theo dõi trạng thái gán nhãn
- Xuất dữ liệu đã duyệt

### Annotator
- Nhận nhiệm vụ gán nhãn được phân công
- Xem hướng dẫn gán nhãn và bộ nhãn
- Thực hiện gán nhãn trên dữ liệu
- Đánh dấu hoàn thành và gửi nộp để kiểm duyệt
- Nhận phản hồi và chỉnh sửa nhãn

### Reviewer
- Nhận danh sách dữ liệu đã nộp cần kiểm duyệt
- Đối chiếu nhãn với hướng dẫn
- Phê duyệt nhãn hoặc trả về làm lại
- Ghi nhận loại lỗi theo danh mục

### Admin
- Quản lý người dùng
- Cấu hình hệ thống
- Quản lý nhật ký hoạt động

## Tài khoản mẫu

Sau khi chạy `npm run seed`, bạn có thể đăng nhập với các tài khoản sau:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Manager | manager@example.com | manager123 |
| Annotator | annotator1@example.com | annotator123 |
| Reviewer | reviewer@example.com | reviewer123 |

Xem file `TAI_KHOAN_MAU.md` để biết chi tiết và `HUONG_DAN_SU_DUNG.md` để biết cách sử dụng.

## Deploy

Xem file [DEPLOY.md](./DEPLOY.md) để biết hướng dẫn deploy chi tiết lên production server.

## Cấu trúc dự án

```
WDP/
├── backend/
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   ├── uploads/         # Uploaded files
│   └── server.js        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── context/     # React context
│   │   └── App.js       # Main app component
│   └── public/
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Projects
- `GET /api/projects` - Lấy danh sách projects
- `POST /api/projects` - Tạo project mới
- `GET /api/projects/:id` - Lấy chi tiết project
- `PUT /api/projects/:id` - Cập nhật project
- `DELETE /api/projects/:id` - Xóa project

### Datasets
- `GET /api/datasets/project/:projectId` - Lấy datasets của project
- `POST /api/datasets` - Upload dataset
- `DELETE /api/datasets/:id` - Xóa dataset

### Tasks
- `GET /api/tasks/my-tasks` - Lấy tasks của user
- `GET /api/tasks/:id` - Lấy chi tiết task
- `POST /api/tasks/assign` - Phân công tasks
- `PUT /api/tasks/:id/label` - Cập nhật labels
- `POST /api/tasks/:id/submit` - Nộp task để review

### Reviews
- `GET /api/reviews/pending` - Lấy tasks cần review
- `POST /api/reviews/:id/approve` - Phê duyệt task
- `POST /api/reviews/:id/reject` - Từ chối task

### Users (Admin only)
- `GET /api/users` - Lấy danh sách users
- `PUT /api/users/:id` - Cập nhật user
- `DELETE /api/users/:id` - Xóa user
