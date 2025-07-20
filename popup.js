const OPENROUTER_API_KEY = "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";// 🔁 Replace with your actual OpenRouter API key



document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const roadmapContainer = document.getElementById("roadmap");
  const weakTagsContainer = document.getElementById("weak-tags");
  const refreshBtn = document.getElementById("refreshBtn");
  const recommendList = document.getElementById("recommend-list");
  const notifyToggle = document.getElementById("notifyToggle");

  async function loadUserData() {
    chrome.storage.local.get("codeforcesHandle", async (data) => {
      const handle = data.codeforcesHandle;

      if (handle) {
        status.innerHTML = `👤 Logged in as <strong>${handle}</strong>`;

        const rating = await getCodeforcesRating(handle);
        const roadmap = getRoadmapByRating(rating);
        roadmapContainer.innerHTML = "";
        roadmap.forEach((task) => {
          const li = document.createElement("li");
          li.textContent = task;
          roadmapContainer.appendChild(li);
        });
        updateRoadmapProgress(); // 📊 Update roadmap progress bar


        const weakTags = await getWeakTags(handle);
        weakTagsContainer.innerHTML = "";
        if (weakTags.length === 0) {
          weakTagsContainer.innerHTML = "<li>No weak tags detected</li>";
        } else {
          weakTags.forEach((tagObj) => {
            const li = document.createElement("li");
            li.textContent = `${tagObj.tag} — ${Math.round(tagObj.accuracy * 100)}% accuracy`;
            weakTagsContainer.appendChild(li);
          });
        }

        const recommendations = await getRecommendedProblems(handle, weakTags);
        recommendList.innerHTML = "";
        if (recommendations.length === 0) {
          recommendList.innerHTML = "<li>No practice problems found for now.</li>";
        } else {
          recommendations.forEach((prob) => {
            const li = document.createElement("li");
            li.innerHTML = `<strong>${prob.tag}</strong>: <a href="${prob.link}" target="_blank">${prob.title}</a>`;
            recommendList.appendChild(li);
          });
        }
      } else {
        status.innerText = "⚠️ Open a Codeforces profile first.";
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      status.innerText = "🔄 Refreshing...";
      loadUserData();
      loadHabitTracker();
    });
  }

  loadUserData();
  loadHabitTracker();
  setupNotificationReminder();
});

// Codeforces API rating
async function getCodeforcesRating(handle) {
  try {
    const res = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
    const data = await res.json();
    if (data.status === "OK") return data.result[0].rating || 0;
  } catch (e) {
    console.error("Rating fetch error:", e);
  }
  return 0;
}

// Roadmap
function getRoadmapByRating(rating) {
  if (rating < 1200) {
    return [
      "✔ Solve 20 A-level problems",
      "✔ Learn Sorting + Binary Search",
      "🚀 Start practicing B-level problems (900–1100)"
    ];
  } else if (rating < 1400) {
    return [
      "✔ Master all A+B problems (up to 1100)",
      "🧠 Study Two Pointers, Prefix Sums, Greedy",
      "🚀 Solve 5 rated 1200-level problems"
    ];
  } else {
    return [
      "🔥 Solve 20 1300–1400 rated problems",
      "📚 Practice C-level problems regularly",
      "🧠 Learn Trees, Graphs, DSU, Binary Search templates"
    ];
  }
}

// Weak Tags
async function getWeakTags(handle) {
  const tagStats = {};
  try {
    const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&count=1000`);
    const data = await res.json();
    if (data.status !== "OK") return [];

    for (const sub of data.result) {
      if (!sub.problem || !sub.verdict || !sub.problem.tags) continue;
      const isAccepted = sub.verdict === "OK";
      sub.problem.tags.forEach((tag) => {
        if (!tagStats[tag]) tagStats[tag] = { solved: 0, attempted: 0 };
        tagStats[tag].attempted++;
        if (isAccepted) tagStats[tag].solved++;
      });
    }

    return Object.entries(tagStats)
      .map(([tag, stat]) => ({ tag, accuracy: stat.solved / stat.attempted, attempted: stat.attempted }))
      .filter((t) => t.attempted >= 5)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);
  } catch (error) {
    console.error("Tag stats error:", error);
    return [];
  }
}

// Recommendations
async function getRecommendedProblems(handle, weakTags) {
  const solvedSet = new Set();
  try {
    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}&count=1000`);
    const statusData = await statusRes.json();
    if (statusData.status !== "OK") return [];

    statusData.result.forEach((s) => {
      if (s.verdict === "OK" && s.problem) {
        solvedSet.add(`${s.problem.contestId}-${s.problem.index}`);
      }
    });

    const allRes = await fetch('https://codeforces.com/api/problemset.problems');
    const allData = await allRes.json();
    const problems = allData.result.problems;
    const rec = [];

    for (const tagObj of weakTags) {
      let count = 0;
      for (const prob of problems) {
        const id = `${prob.contestId}-${prob.index}`;
        if (
          prob.tags.includes(tagObj.tag) &&
          !solvedSet.has(id) &&
          prob.rating >= 800 &&
          prob.rating <= 1400 &&
          count < 2
        ) {
          rec.push({
            tag: tagObj.tag,
            title: `${prob.name} (${prob.rating})`,
            link: `https://codeforces.com/problemset/problem/${prob.contestId}/${prob.index}`
          });
          count++;
        }
      }
    }

    return rec;
  } catch (err) {
    console.error("Recommendation error:", err);
    return [];
  }
}

// Tab Switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

// Habit Tracker + Streak
function loadHabitTracker() {
  const habitGrid = document.getElementById("habit-grid");
  const streakInfo = document.getElementById("streak-info");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayIndex = (new Date().getDay() + 6) % 7;

  let habitData = JSON.parse(localStorage.getItem("habitData") || "{}");
  habitGrid.innerHTML = "";

  days.forEach((day) => {
    const div = document.createElement("div");
    div.className = "habit-day";
    if (habitData[day]) div.classList.add("active");
    div.innerText = day;
    div.onclick = () => {
      habitData[day] = !habitData[day];
      localStorage.setItem("habitData", JSON.stringify(habitData));
      loadHabitTracker();
    };
    habitGrid.appendChild(div);
  });

  // 🔥 Calculate streak
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const index = (todayIndex - i + 7) % 7;
    if (habitData[days[index]]) streak++;
    else break;
  }
  streakInfo.innerText = `🔥 ${streak}-day streak`;
  updateStreakProgress(streak); // 🎉 Update visual streak bar and trigger confetti

}

// Notifications
function setupNotificationReminder() {
  chrome.storage.local.get("notificationsEnabled", (data) => {
    const enabled = data.notificationsEnabled;
    if (!enabled) return;

    const today = (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(new Date()).getDay()]);
    const habitData = JSON.parse(localStorage.getItem("habitData") || "{}");

    if (!habitData[today]) {
      chrome.notifications?.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "CP Reminder",
        message: "Don't forget to solve at least 1 problem today 💪"
      });
    }
  });
}
async function loadLearningPaths() {
  const container = document.getElementById("learning-paths");
  container.innerHTML = "⏳ Generating learning paths...";

  chrome.storage.local.get("codeforcesHandle", async (data) => {
    const handle = data.codeforcesHandle;
    if (!handle) {
      container.innerHTML = "⚠️ Please open a Codeforces profile.";
      return;
    }

    const weakTags = await getWeakTags(handle);
    if (!weakTags || weakTags.length === 0) {
      container.innerHTML = "✅ No weak tags detected.";
      return;
    }

    const pathsHTML = await Promise.all(
      weakTags.map(async (tagObj) => {
        const tag = tagObj.tag;
        const explanation = await fetchExplanation(tag);
        const video = await fetchYoutubeVideo(tag);
        const problems = await fetchCFProblems(tag);

        return `
          <div class="learning-box">
            <h5>🔹 ${tag}</h5>
            <p>${explanation}</p>
            ${video}
            <strong>Practice:</strong>
            ${problems.map(p => `<a href="${p.link}" target="_blank">${p.title}</a>`).join("")}
          </div>
        `;
      })
    );

    container.innerHTML = pathsHTML.join("");
  });
}

// GPT Fetch Wrapper
async function fetchFromGPT(messages) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages
      })
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "⚠️ No response generated.";
  } catch (err) {
    return `❌ Error: ${err.message}`;
  }
}

// GPT Mentor Logic
document.getElementById("askBtn").addEventListener("click", async () => {
  const query = document.getElementById("query").value.trim();
  const response = document.getElementById("response");
  if (!query) {
    response.innerText = "⚠️ Please enter a topic.";
    return;
  }
  response.innerText = "⏳ Thinking...";
  const result = await fetchFromGPT([
    { role: "system", content: "Explain the competitive programming topic in simple terms for a beginner in 3-4 lines." },
    { role: "user", content: query }
  ]);
  response.innerText = result;
});

// Contest Reflection Generator
// ✅ Contest Reflection Generator — FIXED
//let heatmapChart;

document.addEventListener("DOMContentLoaded", () => {
  const reflectBtn = document.getElementById("reflectBtn");
  const reflectOutput = document.getElementById("reflectionResult");

  reflectBtn.addEventListener("click", async () => {
    const input = document.getElementById("contestInput").value.trim();
    const handle = document.getElementById("cfHandle").value.trim();

    if (!input || !handle) {
      reflectOutput.innerText = "⚠️ Please enter both your contest summary and Codeforces handle.";
      return;
    }

    reflectOutput.innerText = "⏳ Generating reflection...";

    try {
      // 🔹 GPT Reflection Generation
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer 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 ", // replace with your real key
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct:free",
          messages: [
            {
              role: "system",
              content: `You're a helpful competitive programming coach. Given a contest performance summary, generate a reflection containing:
(1) What went wrong,
(2) How to improve,
(3) Mistakes repeated from past contests,
(4) Action plan to do better next time.`
            },
            {
              role: "user",
              content: input
            }
          ]
        })
      });

      const data = await response.json();
      const responseText = data?.choices?.[0]?.message?.content?.trim();
      reflectOutput.innerText = responseText || "⚠️ No reflection generated.";

    } catch (err) {
      reflectOutput.innerText = "❌ Error generating reflection.";
      console.error(err);
    }

  });  

  // 🔹 Tab Switching Logic
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab, idx) => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      tabContents.forEach(c => c.style.display = "none");
      tabContents[idx].style.display = "block";
    });
  });
});

// 🔹 Fetch number of problems solved per contest
async function fetchSolvedPerContest(handle) {
  const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
  const data = await res.json();

  const solvedMap = {};

  if (data.status === "OK") {
    data.result.forEach(sub => {
      if (sub.verdict === "OK" && sub.problem.contestId) {
        const cid = sub.problem.contestId;
        solvedMap[cid] = (solvedMap[cid] || new Set()).add(sub.problem.name);
      }
    });

    // Convert set sizes to number
    const contestStats = Object.entries(solvedMap).map(([cid, probs]) => ({
      contestId: cid,
      solvedCount: probs.size
    }));

    return contestStats;
  }

  return [];
}

// 🔹 Fetch rating change history
async function fetchRatingChanges(handle) {
  const res = await fetch(`https://codeforces.com/api/user.rating?handle=${handle}`);
  const data = await res.json();

  if (data.status === "OK") {
    return data.result.map(entry => ({
      contestName: entry.contestName,
      oldRating: entry.oldRating,
      newRating: entry.newRating
    }));
  }

  return [];
}

// 🔹 Render Heatmap (Bar Chart)
function renderHeatmap(stats) {
  const ctx = document.getElementById("heatmapContainer").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: stats.map(e => e.contestId),
      datasets: [{
        label: "Problems Solved",
        data: stats.map(e => e.solvedCount),
        backgroundColor: "#4caf50"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Problems Solved Per Contest"
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// 🔹 Render Rating Change (Line Chart)
function renderRatingChart(stats) {
  const ctx = document.getElementById("ratingChartContainer").getContext("2d");

  const labels = stats.map(e => e.contestName);
  const ratings = stats.map(e => e.newRating);

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Rating",
        data: ratings,
        borderColor: "#2196f3",
        fill: false,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Rating Change Over Contests"
        }
      },
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}










// 🌙 Dark/Light Mode Toggle
document.addEventListener("DOMContentLoaded", () => {
  const modeToggle = document.getElementById("modeToggle");
  if (modeToggle) {
    const isDark = localStorage.getItem("darkMode") === "true";
    document.body.classList.toggle("dark-mode", isDark);
    modeToggle.innerText = isDark ? "☀️" : "🌙";

    modeToggle.addEventListener("click", () => {
      const isDarkNow = document.body.classList.toggle("dark-mode");
      modeToggle.innerText = isDarkNow ? "☀️" : "🌙";
      localStorage.setItem("darkMode", isDarkNow);
    });
  }
});

// 🎉 Confetti Trigger (on streak >= 3)
function triggerConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");

  const confetti = [];
  for (let i = 0; i < 100; i++) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * 50,
      color: `hsl(${Math.random() * 360}, 100%, 60%)`,
      tilt: Math.random() * 10 - 10,
      tiltAngleIncremental: (Math.random() * 0.07) + 0.05,
      tiltAngle: 0
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confetti.forEach((c) => {
      ctx.beginPath();
      ctx.lineWidth = c.r / 2;
      ctx.strokeStyle = c.color;
      ctx.moveTo(c.x + c.tilt + c.r / 2, c.y);
      ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r / 2);
      ctx.stroke();
    });
    update();
  }

  function update() {
    confetti.forEach((c) => {
      c.tiltAngle += c.tiltAngleIncremental;
      c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2;
      c.x += Math.sin(0);
      c.tilt = Math.sin(c.tiltAngle - i / 3) * 15;
      if (c.y > canvas.height) c.y = -10;
    });
  }

  setInterval(draw, 20);
}

// 🔥 Habit Tracker Progress Bar and Confetti
function updateStreakProgress(streak) {
  const bar = document.getElementById("streakProgress");
  if (bar) {
    const percent = Math.min((streak / 7) * 100, 100);
    bar.style.width = `${percent}%`;
    bar.innerText = `${streak}-day streak`;
    if (streak >= 3) triggerConfetti();
  }
}

// 📌 Roadmap Progress Bar (based on checked items)
function updateRoadmapProgress() {
  const list = document.querySelectorAll("#roadmap li");
  const progress = document.getElementById("roadmapProgress");
  if (!list.length || !progress) return;

  let completed = 0;
  list.forEach((li) => {
    if (li.textContent.includes("✔")) completed++;
  });

  const percent = Math.round((completed / list.length) * 100);
  progress.style.width = `${percent}%`;
  progress.innerText = `${percent}% Complete`;
}
document.getElementById("modeToggle").addEventListener("click", () => {
  const body = document.body;
  const isDark = body.classList.contains("dark-mode");
  body.classList.toggle("dark-mode", !isDark);
  body.classList.toggle("light-mode", isDark);

  // Save preference
  localStorage.setItem("theme", isDark ? "light" : "dark");

  // Change icon
  document.getElementById("modeToggle").innerText = isDark ? "🌞" : "🌙";
});

// Load saved theme on load
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.body.classList.add(savedTheme + "-mode");
  document.getElementById("modeToggle").innerText = savedTheme === "dark" ? "🌙" : "🌞";
});
function applyTheme(theme) {
  const body = document.body;
  body.classList.remove("dark-mode", "light-mode");
  body.classList.add(`${theme}-mode`);
  document.getElementById("modeToggle").innerText = theme === "dark" ? "🌙" : "🌞";
}

document.getElementById("modeToggle").addEventListener("click", () => {
  const currentTheme = document.body.classList.contains("dark-mode") ? "dark" : "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  localStorage.setItem("theme", newTheme);
});




















