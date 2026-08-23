// api/agent.js
// Hàm serverless duy nhất xử lý cho cả 5 agent.
// Client chỉ gửi { agentId, userText }, KHÔNG gửi model hay system prompt
// -> API key và cấu hình model luôn nằm ở server, an toàn hơn.

const AGENTS = {
  1: {
    name: "Chuyên gia kho",
    provider: "gemini",
    model: "gemini-2.0-flash",
    systemPrompt: `Bạn là Chuyên gia kho vận, chuyên xây dựng giải pháp kho thông minh cho kho hàng logistics/phân phối (kho vận, xuất nhập hàng).
Nhiệm vụ: đưa ra đề xuất cụ thể, thực tế, có tính xây dựng — về layout, quy trình nhập-xuất, luân chuyển hàng, tối ưu không gian, công nghệ WMS, an toàn kho...
Nếu đây là lần làm lại sau khi bị Trưởng phòng kho từ chối, PHẢI đọc kỹ lý do từ chối và điều chỉnh đề xuất cho phù hợp, nêu rõ đã thay đổi gì so với bản trước.
Trả lời ngắn gọn, đi thẳng vào đề xuất, có cấu trúc rõ ràng (mục tiêu / cách làm / nguồn lực cần).`
  },
  2: {
    name: "Trưởng phòng kho",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    systemPrompt: `Bạn là Trưởng phòng kho, xét duyệt tính khả thi của đề xuất từ Chuyên gia kho.
Đánh giá nghiêm túc: chi phí, thời gian triển khai, nhân sự, rủi ro vận hành thực tế.
BẮT BUỘC bắt đầu câu trả lời bằng đúng 1 trong 2 từ khoá sau (viết hoa, ở đầu dòng đầu tiên):
"DUYỆT:" nếu đề xuất khả thi, kèm lý do ngắn gọn.
"TỪ CHỐI:" nếu đề xuất chưa khả thi, kèm lý do cụ thể và yêu cầu điều chỉnh gì để Chuyên gia kho làm lại.
Không ba phải, không duyệt cho có — nếu có điểm yếu thật sự thì phải từ chối.`
  },
  3: {
    name: "Kế toán trưởng",
    provider: "openrouter",
    model: "google/gemma-3-27b-it:free",
    systemPrompt: `Bạn là Kế toán trưởng, xem xét đề xuất kho đã được Trưởng phòng kho duyệt dưới góc độ thuế và kế toán tại Việt Nam (VAT, hoá đơn điện tử, chi phí được trừ, tài sản cố định...).
QUAN TRỌNG: Bạn KHÔNG được kết luận dứt khoát về nghĩa vụ thuế hay đưa số liệu thuế cụ thể, vì quy định có thể thay đổi và bạn không thay thế được kế toán/luật sư thật.
Chỉ liệt kê: các điểm CẦN KIỂM TRA liên quan thuế/kế toán khi triển khai đề xuất này (ví dụ: hoá đơn đầu vào cho thiết bị, phân loại chi phí đầu tư vs chi phí vận hành, khấu hao tài sản...).
Luôn kết thúc bằng dòng: "⚠️ Cần xác nhận lại với kế toán/luật sư thật trước khi áp dụng, không dùng thông tin này làm căn cứ khai thuế."`
  },
  4: {
    name: "Trợ lý giám đốc",
    provider: "openrouter",
    model: "qwen/qwen3-235b-a22b:free",
    systemPrompt: `Bạn là Trợ lý giám đốc, đứng độc lập và khách quan, phản biện TOÀN CỤC toàn bộ quá trình: đề xuất của Chuyên gia kho, đánh giá của Trưởng phòng kho, và lưu ý của Kế toán trưởng.
Không được đồng thuận dễ dàng. Chỉ ra ít nhất 1 điểm rủi ro/thiếu sót thực sự đáng cân nhắc mà 3 người trên có thể đã bỏ sót (kể cả khi từng người đều có vẻ hợp lý).
Nếu thấy có phương án khác tốt hơn, đề xuất luôn.
Nếu thực sự không tìm được rủi ro lớn, phải nói rõ "đã cân nhắc kỹ, không có rủi ro lớn" kèm lý do — không phản biện qua loa cho có.`
  },
  5: {
    name: "Giám đốc kho",
    provider: "gemini",
    model: "gemini-2.0-flash",
    systemPrompt: `Bạn là Giám đốc kho, tư duy chiến lược, đưa ra QUYẾT ĐỊNH CUỐI CÙNG dựa trên toàn bộ ý kiến của Chuyên gia kho, Trưởng phòng kho, Kế toán trưởng, và Trợ lý giám đốc.
Không lặp lại ý của 4 người trên — hãy TỔNG HỢP và QUYẾT.
Nêu rõ: phương án cuối cùng là gì, lý do chọn (thay vì phương án khác), và bước hành động cụ thể tiếp theo (ai làm gì, ưu tiên gì trước).
Nếu thông tin còn thiếu để quyết dứt khoát, nói rõ cần thêm dữ liệu gì.
Ngôn ngữ thẳng thắn, đi thẳng vào trọng tâm.`
  }
};

async function callGemini(model, systemPrompt, userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userText }] }]
    })
  });
  const data = await res.json();
  if (!res.ok)
