# Hội đồng Kho vận — 5 Agent

Web app chạy 5 "nhân sự AI" tuần tự: Chuyên gia kho → Trưởng phòng kho (duyệt/từ chối, lặp tối đa 3 vòng) → Kế toán trưởng → Trợ lý giám đốc → Giám đốc kho.

## Deploy lên Vercel (miễn phí)

1. Tạo tài khoản GitHub (github.com) nếu chưa có.
2. Tạo repository mới (New repository), đặt tên tuỳ ý, để Public hoặc Private đều được.
3. Bấm "uploading an existing file" → kéo thả toàn bộ các file/folder trong thư mục này vào → Commit.
4. Vào vercel.com → đăng nhập bằng tài khoản GitHub → "Add New" → "Project" → chọn repo vừa tạo → Import.
5. Trước khi bấm Deploy, mở mục "Environment Variables", thêm đúng 3 biến:
   - `GEMINI_API_KEY` = key lấy từ aistudio.google.com
   - `GROQ_API_KEY` = key lấy từ console.groq.com
   - `OPENROUTER_API_KEY` = key lấy từ openrouter.ai
6. Bấm Deploy. Chờ khoảng 1 phút, Vercel sẽ cấp cho bạn 1 link dạng `ten-du-an.vercel.app` — mở link này trên điện thoại là dùng được, mọi lúc mọi nơi.

## Nếu model OpenRouter báo lỗi "not found"

Model miễn phí trên OpenRouter thay đổi theo tuần. Vào https://openrouter.ai/models?fmt=free để xem model free hiện tại, copy ID (kết thúc bằng `:free`), rồi sửa trong file `api/agent.js` ở dòng `model:` của agent 3 và agent 4.
