# Changelog - Logic Fixes theo Đề Tài

## Tổng quan
Đã rà soát và sửa lại toàn bộ logic hệ thống theo đúng yêu cầu đề tài cho từng role.

## Các thay đổi chính

### 1. Manager - Quản lý Projects

#### Validation khi tạo Project
- ✅ **Bắt buộc**: `name` và `guidelines` phải có giá trị
- ✅ **Tùy chọn**: `labelSet` và `questions` có thể để trống
- ✅ **Validation labelSet**: Nếu có, mỗi label phải có `name`
- ✅ **Validation questions**: Nếu có, mỗi question phải có text và ít nhất 2 options
- ✅ **Status mặc định**: `draft` nếu không chỉ định

#### Quản lý Datasets
- ✅ Manager chỉ thấy datasets của projects mình quản lý
- ✅ Upload files với validation file size và type
- ✅ Xóa dataset sẽ xóa cả files vật lý

#### Phân công Tasks
- ✅ Chỉ có thể assign tasks cho annotators active
- ✅ Validation: không tạo duplicate tasks
- ✅ Tasks được tạo với status `assigned`

#### Theo dõi chất lượng
- ✅ Quality dashboard với thống kê chi tiết
- ✅ Export data với 3 formats: JSON, CSV, COCO

### 2. Annotator - Gán nhãn

#### Nhận Tasks
- ✅ Chỉ thấy tasks được phân công cho mình
- ✅ Xem được guidelines và labelSet của project
- ✅ Hiển thị status rõ ràng

#### Gán nhãn
- ✅ **Validation labels**: Nếu project có labelSet, chỉ được dùng labels hợp lệ
- ✅ **Validation answers**: Nếu project có questions, phải trả lời đầy đủ
- ✅ **Status workflow**: 
  - `assigned` → `in_progress` (khi bắt đầu gán nhãn)
  - `rejected` → `in_progress` (khi chỉnh sửa lại)

#### Nộp bài
- ✅ **Validation bắt buộc**: Phải có labels trước khi submit
- ✅ **Validation answers**: Nếu có questions, phải có answers
- ✅ **Status**: Chỉ submit được từ `in_progress` hoặc `assigned`
- ✅ **Không thể submit**: Nếu đã `submitted` hoặc `approved`

#### Nhận phản hồi
- ✅ Hiển thị review comments khi bị reject
- ✅ Hiển thị error category
- ✅ Có thể chỉnh sửa và nộp lại

### 3. Reviewer - Kiểm duyệt

#### Nhận danh sách
- ✅ Chỉ thấy tasks có status `submitted`
- ✅ Xem được lịch sử review của mình (approved/rejected)
- ✅ Sắp xếp theo thời gian submit

#### Đối chiếu và kiểm tra
- ✅ Xem được guidelines của project
- ✅ Xem được labels đã gán
- ✅ Xem được image và annotations

#### Phê duyệt/Trả về
- ✅ **Approve**: 
  - Chỉ approve được tasks `submitted`
  - Có thể thêm comments (optional)
  - Tự động ghi lại reviewer và thời gian
  
- ✅ **Reject**:
  - **Bắt buộc** phải có review comments
  - Phải chọn error category
  - Tự động ghi lại reviewer và thời gian

#### Ghi nhận lỗi
- ✅ Error categories:
  - `incorrect_label`: Nhãn sai
  - `missing_label`: Thiếu nhãn
  - `poor_quality`: Chất lượng kém
  - `does_not_follow_guidelines`: Không tuân theo hướng dẫn
  - `other`: Khác

### 4. Admin - Quản lý hệ thống

#### Quản lý Users
- ✅ Xem tất cả users
- ✅ Thay đổi role và status
- ✅ Xóa users (với validation)

#### Cấu hình hệ thống
- ✅ System Settings với 6 tabs:
  - General: Tên hệ thống, maintenance mode, registration
  - Email: SMTP configuration
  - Storage: File limits, allowed types
  - Tasks: Max tasks, auto assign
  - Review: Review rules
  - Notifications: Email notifications

#### Quản lý Activity Logs
- ✅ Xem tất cả activity logs
- ✅ Filter theo action, user, resource type
- ✅ Thống kê top actions và users

## Workflow đã sửa

### Task Lifecycle
```
assigned → in_progress → submitted → approved/rejected
                              ↓
                         rejected → in_progress → submitted → ...
```

### Validation Rules

1. **Project Creation**:
   - Name: Required
   - Guidelines: Required
   - LabelSet: Optional, nhưng nếu có thì phải valid
   - Questions: Optional, nhưng nếu có thì phải có ít nhất 2 options

2. **Labeling**:
   - Labels phải dùng đúng labelSet của project (nếu có)
   - Answers phải đầy đủ nếu project có questions

3. **Submission**:
   - Phải có labels
   - Phải có answers nếu có questions
   - Chỉ submit được từ `in_progress` hoặc `assigned`

4. **Review**:
   - Chỉ review được tasks `submitted`
   - Reject phải có comments và error category
   - Approve có thể có comments (optional)

## Authorization đã sửa

- ✅ Manager chỉ thấy projects của mình
- ✅ Annotator chỉ thấy tasks của mình
- ✅ Reviewer chỉ thấy submitted tasks hoặc tasks mình đã review
- ✅ Admin thấy tất cả
- ✅ Validation ownership khi edit/delete

## Các cải thiện

1. **Error Messages**: Rõ ràng và hữu ích hơn
2. **Validation**: Đầy đủ và chặt chẽ hơn
3. **User Experience**: Thông báo rõ ràng, confirmations
4. **Data Integrity**: Đảm bảo workflow đúng, không skip steps

## Testing Checklist

- [ ] Manager tạo project với/không có labels và questions
- [ ] Manager upload datasets và assign tasks
- [ ] Annotator nhận tasks và gán nhãn
- [ ] Annotator submit với/không có answers
- [ ] Reviewer approve/reject tasks
- [ ] Annotator chỉnh sửa rejected tasks
- [ ] Manager export data
- [ ] Admin quản lý users và settings
