# Hướng dẫn Deploy Data Labeling Support System

Hướng dẫn chi tiết để deploy hệ thống lên production server.

## Yêu cầu hệ thống

- Node.js >= 14.x
- MongoDB >= 4.4
- NPM hoặc Yarn
- PM2 (khuyến nghị cho production)

## Các phương pháp Deploy

### Phương pháp 1: Deploy trên cùng server (Recommended)

Backend và Frontend chạy trên cùng một server, backend serve static files từ frontend build.

#### Bước 1: Chuẩn bị server

```bash
# Cài đặt Node.js và MongoDB
# Ubuntu/Debian:
sudo apt update
sudo apt install nodejs npm mongodb

# Hoặc sử dụng nvm để cài Node.js phiên bản mới nhất
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

#### Bước 2: Clone và cài đặt dependencies

```bash
# Clone project (hoặc upload code lên server)
cd /var/www  # hoặc thư mục bạn muốn
git clone <your-repo-url> data-labeling
cd data-labeling

# Cài đặt backend dependencies
cd backend
npm install --production

# Cài đặt frontend dependencies và build
cd ../frontend
npm install
npm run build
```

#### Bước 3: Cấu hình Backend

```bash
cd ../backend

# Tạo file .env từ .env.example
cp .env.example .env

# Chỉnh sửa .env với thông tin production
nano .env
```

Nội dung file `.env`:
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/data-labeling
JWT_SECRET=your-very-secure-secret-key-change-this
```

**Lưu ý quan trọng:**
- Thay đổi `JWT_SECRET` thành một chuỗi ngẫu nhiên mạnh
- Nếu dùng MongoDB Atlas (cloud), cập nhật `MONGODB_URI`
- Đảm bảo MongoDB đang chạy: `sudo systemctl start mongodb`

#### Bước 4: Khởi tạo database

```bash
# Chạy seed script để tạo tài khoản mẫu (chỉ lần đầu)
npm run seed
```

#### Bước 5: Chạy với PM2 (Production)

```bash
# Cài đặt PM2 globally
sudo npm install -g pm2

# Khởi động ứng dụng với PM2
cd /var/www/data-labeling/backend
pm2 start server.js --name "data-labeling-api"

# Lưu cấu hình PM2 để tự động khởi động khi server reboot
pm2 save
pm2 startup

# Xem logs
pm2 logs data-labeling-api

# Các lệnh PM2 hữu ích:
# pm2 restart data-labeling-api  # Restart
# pm2 stop data-labeling-api      # Dừng
# pm2 delete data-labeling-api    # Xóa
```

#### Bước 6: Cấu hình Nginx (Reverse Proxy)

```bash
# Cài đặt Nginx
sudo apt install nginx

# Tạo file cấu hình
sudo nano /etc/nginx/sites-available/data-labeling
```

Nội dung file cấu hình:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Thay bằng domain của bạn

    # Redirect HTTP to HTTPS (nếu có SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Tăng kích thước upload (cho file ảnh lớn)
    client_max_body_size 100M;
}
```

```bash
# Kích hoạt site
sudo ln -s /etc/nginx/sites-available/data-labeling /etc/nginx/sites-enabled/
sudo nginx -t  # Kiểm tra cấu hình
sudo systemctl restart nginx
```

#### Bước 7: Cấu hình SSL với Let's Encrypt (Khuyến nghị)

```bash
# Cài đặt Certbot
sudo apt install certbot python3-certbot-nginx

# Lấy SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot sẽ tự động cấu hình Nginx và renew certificate
```

### Phương pháp 2: Deploy riêng biệt (Backend và Frontend tách biệt)

#### Backend Deployment

```bash
cd backend
npm install --production
cp .env.example .env
# Chỉnh sửa .env
npm run seed  # Lần đầu
pm2 start server.js --name "data-labeling-api"
```

Backend sẽ chạy trên port 5000 (hoặc port trong .env).

#### Frontend Deployment

```bash
cd frontend
npm install

# Tạo file .env.production
echo "REACT_APP_API_URL=http://your-backend-domain.com:5000" > .env.production

npm run build

# Serve với Nginx hoặc Apache
# Copy thư mục build/ lên server web
```

Cấu hình Nginx cho Frontend:
```nginx
server {
    listen 80;
    server_name your-frontend-domain.com;
    root /var/www/data-labeling/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Cấu hình Frontend cho Production

Tạo file `frontend/.env.production`:
```env
REACT_APP_API_URL=https://your-backend-domain.com
```

Sau đó build lại:
```bash
cd frontend
npm run build
```

## Firewall Configuration

```bash
# Mở port 80 và 443 (HTTP/HTTPS)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Nếu chạy backend trực tiếp (không qua Nginx), mở port 5000
# sudo ufw allow 5000/tcp

sudo ufw enable
```

## Monitoring và Maintenance

### Xem logs

```bash
# PM2 logs
pm2 logs data-labeling-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Backup Database

```bash
# Backup MongoDB
mongodump --out=/backup/mongodb/$(date +%Y%m%d)

# Restore
mongorestore /backup/mongodb/20240101
```

### Update Application

```bash
cd /var/www/data-labeling

# Pull code mới
git pull origin main

# Update backend
cd backend
npm install --production
pm2 restart data-labeling-api

# Update frontend
cd ../frontend
npm install
npm run build
pm2 restart data-labeling-api  # Restart để serve build mới
```

## Troubleshooting

### Lỗi "Cannot find module"
```bash
# Xóa node_modules và cài lại
rm -rf node_modules package-lock.json
npm install
```

### Lỗi MongoDB connection
```bash
# Kiểm tra MongoDB đang chạy
sudo systemctl status mongodb

# Khởi động MongoDB
sudo systemctl start mongodb
```

### Lỗi Permission denied
```bash
# Đảm bảo quyền đúng cho thư mục uploads
sudo chown -R $USER:$USER backend/uploads
chmod -R 755 backend/uploads
```

### Frontend không load được API
- Kiểm tra `REACT_APP_API_URL` trong `.env.production`
- Kiểm tra CORS settings trong backend
- Kiểm tra firewall và Nginx configuration

## Security Checklist

- [ ] Đổi `JWT_SECRET` thành giá trị ngẫu nhiên mạnh
- [ ] Cấu hình HTTPS với SSL certificate
- [ ] Cấu hình firewall (UFW)
- [ ] Đặt MongoDB chỉ listen trên localhost (nếu không cần remote access)
- [ ] Sử dụng MongoDB authentication
- [ ] Backup database định kỳ
- [ ] Cập nhật dependencies thường xuyên
- [ ] Sử dụng environment variables cho sensitive data
- [ ] Giới hạn kích thước upload file

## Performance Optimization

1. **Enable Gzip compression trong Nginx:**
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

2. **Caching static files:**
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

3. **MongoDB Indexing:** Đảm bảo các trường thường query có index

## Support

Nếu gặp vấn đề, kiểm tra:
1. Logs của PM2, Nginx, và MongoDB
2. Network connectivity
3. File permissions
4. Environment variables
