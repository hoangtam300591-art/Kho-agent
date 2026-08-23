var AGENTS = {
  1: {
    name: "Chuyên gia kho",
    provider: "gemini",
    model: "gemini-1.5-flash-latest",
    systemPrompt: "Ban la Chuyen gia kho van, chuyen xay dung giai phap kho thong minh cho kho hang logistics/phan phoi (kho van, xuat nhap hang).\n" +
      "Nhiem vu: dua ra de xuat cu the, thuc te, co tinh xay dung - ve layout, quy trinh nhap-xuat, luan chuyen hang, toi uu khong gian, cong nghe WMS, an toan kho...\n" +
      "Neu day la lan lam lai sau khi bi Truong phong kho tu choi, PHAI doc ky ly do tu choi va dieu chinh de xuat cho phu hop, neu ro da thay doi gi so voi ban truoc.\n" +
      "Tra loi ngan gon, di thang vao de xuat, co cau truc ro rang (muc tieu / cach lam / nguon luc can)."
  },
  2: {
    name: "Trưởng phòng kho",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    systemPrompt: "Ban la Truong phong kho, xet duyet tinh kha thi cua de xuat tu Chuyen gia kho.\n" +
      "Danh gia nghiem tuc: chi phi, thoi gian trien khai, nhan su, rui ro van hanh thuc te.\n" +
      "BAT BUOC bat dau cau tra loi bang dung 1 trong 2 tu khoa sau (viet hoa, o dau dong dau tien):\n" +
      "DUYET: neu de xuat kha thi, kem ly do ngan gon.\n" +
      "TU CHOI: neu de xuat chua kha thi, kem ly do cu the va yeu cau dieu chinh gi de Chuyen gia kho lam lai.\n" +
      "Khong ba phai, khong duyet cho co - neu co diem yeu that su thi phai tu choi."
  },
  3: {
    name: "Kế toán trưởng",
    provider: "openrouter",
    model: "google/gemma-3-27b-it:free",
    systemPrompt: "Ban la Ke toan truong, xem xet de xuat kho da duoc Truong phong kho duyet duoi goc do thue va ke toan tai Viet Nam (VAT, hoa don dien tu, chi phi duoc tru, tai san co dinh...).\n" +
      "QUAN TRONG: Ban KHONG duoc ket luan dut khoat ve nghia vu thue hay dua so lieu thue cu the, vi quy dinh co the thay doi va ban khong thay the duoc ke toan/luat su that.\n" +
      "Chi liet ke: cac diem CAN KIEM TRA lien quan thue/ke toan khi trien khai de xuat nay.\n" +
      "Luon ket thuc bang dong: CAN XAC NHAN LAI VOI KE TOAN/LUAT SU THAT TRUOC KHI AP DUNG, khong dung thong tin nay lam can cu khai thue."
  },
  4: {
    name: "Trợ lý giám đốc",
    provider: "openrouter",
    model: "qwen/qwen3-235b-a22b:free",
    systemPrompt: "Ban la Tro ly giam doc, dung doc lap va khach quan, phan bien TOAN CUC toan bo qua trinh: de xuat cua Chuyen gia kho, danh gia cua Truong phong kho, va luu y cua Ke toan truong.\n" +
      "Khong duoc dong thuan de dang. Chi ra it nhat 1 diem rui ro/thieu sot thuc su dang can nhac ma 3 nguoi tren co the da bo sot.\n" +
      "Neu thay co phuong an khac tot hon, de xuat luon.\n" +
      "Neu thuc su khong tim duoc rui ro lon, phai noi ro da can nhac ky, khong co rui ro lon kem ly do."
  },
  5: {
    name: "Giám đốc kho",
    provider: "gemini",
    model: "gemini-1.5-flash-latest",
    systemPrompt: "Ban la Giam doc kho, tu duy chien luoc, dua ra QUYET DINH CUOI CUNG dua tren toan bo y kien cua Chuyen gia kho, Truong phong kho, Ke toan truong, va Tro ly giam doc.\n" +
      "Khong lap lai y cua 4 nguoi tren - hay TONG HOP va QUYET.\n" +
      "Neu ro: phuong an cuoi cung la gi, ly do chon, va buoc hanh dong cu the tiep theo.\n" +
      "Neu thong tin con thieu de quyet dut khoat, noi ro can them du lieu gi.\n" +
      "Ngon ngu thang than, di thang vao trong tam."
  }
};

async function callGemini(model, systemPrompt, userText) {
  var apiKey = process.env.GEMINI_API_KEY;
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
  var res = await fetch(url, {
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
  var data = await res.json();
  if (!res.ok) {
    throw new Error("Gemini loi: " + (data.error && data.error.message ? data.error.message : res.status));
  }
  var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  if (!parts) return "(Khong co phan hoi)";
  return parts.map(function(p) { return p.text; }).join("");
}

async function callGroq(model, systemPrompt, userText) {
  var apiKey = process.env.GROQ_API_KEY;
  var res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ]
    })
  });
  var data = await res.json();
  if (!res.ok) {
    throw new Error("Groq loi: " + (data.error && data.error.message ? data.error.message : res.status));
  }
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "(Khong co phan hoi)";
}

async function callOpenRouter(model, systemPrompt, userText) {
  var apiKey = process.env.OPENROUTER_API_KEY;
  var res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
      "HTTP-Referer": "https://vercel.app",
      "X-Title": "Hoi dong kho van"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ]
    })
  });
  var data = await res.json();
  if (!res.ok) {
    var msg = (data.error && data.error.message) ? data.error.message : res.status;
    throw new Error("OpenRouter loi: " + msg + ". Model co the da het han free - kiem tra lai tai openrouter.ai/models?fmt=free");
  }
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "(Khong co phan hoi)";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Chi ho tro POST" });
    return;
  }

  try {
    var agentId = req.body.agentId;
    var userText = req.body.userText;
    var agent = AGENTS[agentId];
    if (!agent) {
      res.status(400).json({ error: "agentId khong hop le (phai la 1-5)" });
      return;
    }

    var text;
    if (agent.provider === "gemini") {
      text = await callGemini(agent.model, agent.systemPrompt, userText);
    } else if (agent.provider === "groq") {
      text = await callGroq(agent.model, agent.systemPrompt, userText);
    } else if (agent.provider === "openrouter") {
      text = await callOpenRouter(agent.model, agent.systemPrompt, userText);
    } else {
      throw new Error("Nha cung cap khong xac dinh");
    }

    res.status(200).json({ name: agent.name, text: text });
  } catch (err) {
    res.status(500).json({ error: err.message || "Loi khong xac dinh" });
  }
};
