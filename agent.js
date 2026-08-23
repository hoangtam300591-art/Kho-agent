// api/agent.js
// Hàm serverless duy nhất xử lý cho cả 5 agent.
// Client chỉ gửi { agentId, userText }, KHÔNG gửi model hay system prompt
// -> API key và cấu hình model luôn nằm ở server, an toàn hơn.

// ============ CẤU HÌNH 5 AGENT ============
// Muốn đổi model/prompt sau này, chỉ cần sửa ở đây, không cần đụng chỗ khác.
// LƯU Ý: model free trên OpenRouter thay đổi theo tuần. Nếu agent 3 hoặc 4
// báo lỗi "model not found", vào https://openrouter.ai/models?fmt=free
// để lấy ID model free hiện tại và thay vào bên dưới (giữ đuôi ":free").

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

// ============ HÀM GỌI TỪNG NHÀ CUNG CẤP ============

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
  if (!res.ok) {
    throw new Error(`Gemini lỗi: ${data.error?.message || res.status}`);
  }
  return data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "(Không có phản hồi)";
}

async function callGroq(model, systemPrompt, userText) {
  const apiKey = process.env.GROQ_API_KEY;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Groq lỗi: ${data.error?.message || res.status}`);
  }
  return data.choices?.[0]?.message?.content || "(Không có phản hồi)";
}

async function callOpenRouter(model, systemPrompt, userText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://vercel.app",
      "X-Title": "Hoi dong kho van"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenRouter lỗi: ${data.error?.message || res.status}. Model "${model}" có thể đã hết hạn free — kiểm tra lại tại openrouter.ai/models?fmt=free`);
  }
  return data.choices?.[0]?.message?.content || "(Không có phản hồi)";
}

// ============ HANDLER CHÍNH ============

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Chỉ hỗ trợ POST" });
    return;
  }

  try {
    const { agentId, userText } = req.body;
    const agent = AGENTS[agentId];
    if (!agent) {
      res.status(400).json({ error: "agentId không hợp lệ (phải là 1-5)" });
      return;
    }

    let text;
    if (agent.provider === "gemini") {
      text = await callGemini(agent.model, agent.systemPrompt, userText);
    } else if (agent.provider === "groq") {
      text = await callGroq(agent.model, agent.systemPrompt, userText);
    } else if (agent.provider === "openrouter") {
      text = await callOpenRouter(agent.model, agent.systemPrompt, userText);
    } else {
      throw new Error("Nhà cung cấp không xác định");
    }

    res.status(200).json({ name: agent.name, text });
  } catch (err) {
    res.status(500).json({ error: err.message || "Lỗi không xác định" });
  }
};
