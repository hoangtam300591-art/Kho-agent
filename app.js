const flow = document.getElementById("flow");
const input = document.getElementById("input");
const runBtn = document.getElementById("run");

const STATION_NAMES = {
  1: "Chuyên gia kho",
  2: "Trưởng phòng kho",
  3: "Kế toán trưởng",
  4: "Trợ lý giám đốc",
  5: "Giám đốc kho"
};

function addStation(stepLabel, roleName) {
  const div = document.createElement("div");
  div.className = "station";
  div.innerHTML = `
    <div class="num">${stepLabel}</div>
    <div class="card">
      <div class="role">${roleName}</div>
      <div class="body pending">Đang xử lý...</div>
    </div>
  `;
  flow.appendChild(div);
  return div;
}

function fillStation(stationEl, text, ok = true, badge = null) {
  stationEl.classList.add(ok ? "done" : "error");
  const body = stationEl.querySelector(".body");
  body.classList.remove("pending");
  let html = "";
  if (badge) {
    html += `<span class="badge ${badge.cls}">${badge.label}</span><br>`;
  }
  html += escapeHtml(text);
  body.innerHTML = html;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.innerText = str;
  return d.innerHTML;
}

async function callAgent(agentId, userText) {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, userText })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Lỗi không xác định");
  }
  return data.text;
}

runBtn.addEventListener("click", async () => {
  const userInput = input.value.trim();
  if (!userInput) {
    input.focus();
    return;
  }

  flow.innerHTML = "";
  runBtn.disabled = true;
  runBtn.textContent = "Đang chạy...";

  try {
    // ---- Trạm 1+2: Chuyên gia kho <-> Trưởng phòng kho (tối đa 3 vòng) ----
    let proposal = userInput;
    let approvedProposal = null;
    let round = 0;
    const MAX_ROUNDS = 3;

    while (round < MAX_ROUNDS) {
      round++;

      const s1 = addStation(`1.${round}`, `${STATION_NAMES[1]} (vòng ${round})`);
      const agent1Input = round === 1
        ? `Đề bài: ${userInput}`
        : `Đề bài gốc: ${userInput}\n\nĐề xuất trước bị từ chối với lý do:\n${proposal}\n\nHãy làm lại đề xuất cho phù hợp.`;
      const proposalText = await callAgent(1, agent1Input);
      fillStation(s1, proposalText, true);

      const s2 = addStation(`2.${round}`, `${STATION_NAMES[2]} (vòng ${round})`);
      const reviewText = await callAgent(2, `Đề xuất cần xét duyệt:\n${proposalText}`);
      const isApproved = /^DUYỆT:/i.test(reviewText.trim());
      fillStation(s2, reviewText, true, {
        cls: isApproved ? "duyet" : "tuchoi",
        label: isApproved ? "DUYỆT" : "TỪ CHỐI"
      });

      if (isApproved) {
        approvedProposal = proposalText;
        break;
      } else {
        proposal = reviewText; // lý do từ chối, dùng làm input cho vòng sau
      }
    }

    if (!approvedProposal) {
      // Hết 3 vòng vẫn chưa duyệt -> vẫn đi tiếp với bản đề xuất mới nhất, có ghi chú
      approvedProposal = proposal;
      const note = document.createElement("div");
      note.className = "sub";
      note.style.color = "#e0554f";
      note.style.margin = "8px 0 0 54px";
      note.textContent = "⚠️ Sau 3 vòng vẫn chưa được duyệt — hội đồng vẫn tiếp tục với bản đề xuất gần nhất để tham khảo.";
      flow.appendChild(note);
    }

    // ---- Trạm 3: Kế toán trưởng ----
    const s3 = addStation("3", STATION_NAMES[3]);
    const accountingText = await callAgent(3, `Đề xuất đã qua duyệt:\n${approvedProposal}`);
    fillStation(s3, accountingText, true);

    // ---- Trạm 4: Trợ lý giám đốc ----
    const s4 = addStation("4", STATION_NAMES[4]);
    const summary4 = `Đề xuất: ${approvedProposal}\n\nLưu ý kế toán: ${accountingText}`;
    const criticText = await callAgent(4, summary4);
    fillStation(s4, criticText, true);

    // ---- Trạm 5: Giám đốc kho ----
    const s5 = addStation("5", STATION_NAMES[5]);
    const summary5 = `Đề xuất: ${approvedProposal}\n\nLưu ý kế toán: ${accountingText}\n\nPhản biện của trợ lý giám đốc: ${criticText}`;
    const decisionText = await callAgent(5, summary5);
    fillStation(s5, decisionText, true);

  } catch (err) {
    const errStation = addStation("!", "Lỗi");
    fillStation(errStation, err.message, false);
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Chạy hội đồng";
  }
});
