const OPENROUTER_API_KEY = "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";  // 🔑 Replace this
const MODEL = "mistralai/mistral-7b-instruct:free";

async function askMistral(query) {
  const responseDiv = document.getElementById("response");
  responseDiv.innerHTML = "⏳ Thinking...";

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You are a competitive programming mentor. Teach clearly, give 2 questions for practice." },
          { role: "user", content: query }
        ]
      })
    });

    const data = await res.json();
    if (data.choices && data.choices.length > 0) {
      responseDiv.innerText = data.choices[0].message.content;
    } else {
      responseDiv.innerText = "❌ No response from model.";
    }

  } catch (error) {
    console.error("Error:", error);
    responseDiv.innerText = "❌ Error fetching response.";
  }
}


document.getElementById("askBtn").addEventListener("click", () => {
  const query = document.getElementById("query").value;
  if (query.trim() !== "") {
    askMistral(query);
  }
});

async function showPracticeLinks(tag) {
  const linksDiv = document.createElement("div");
  linksDiv.innerHTML = `<br><strong>🧩 Related Practice Problems:</strong><br>`;

  try {
    const res = await fetch("https://codeforces.com/api/problemset.problems");
    const data = await res.json();
    if (data.status !== "OK") return;

    const problems = data.result.problems;
    let count = 0;

    for (const prob of problems) {
      const matchesTag = prob.tags.includes(tag);
      const withinRange = prob.rating >= 800 && prob.rating <= 1400;

      if (matchesTag && withinRange && count < 3) {
        const url = `https://codeforces.com/problemset/problem/${prob.contestId}/${prob.index}`;
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.innerText = `🔗 ${prob.name} (${prob.rating})`;

        linksDiv.appendChild(document.createElement("br"));
        linksDiv.appendChild(a);
        count++;
      }
    }

    document.getElementById("response").appendChild(linksDiv);
  } catch (e) {
    console.error("Practice link error:", e);
  }
}
