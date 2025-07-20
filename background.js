chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("dailyReminder", {
    when: Date.now() + 10000, // first after 10s
    periodInMinutes: 1440 // every 24 hours
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "dailyReminder") {
    chrome.storage.local.get(["notificationsEnabled", "habitTracker"], (data) => {
      const enabled = data.notificationsEnabled;
      const tracker = data.habitTracker || {};

      if (!enabled) return;

      const todayIndex = new Date().getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const todayKey = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][todayIndex];

      const marked = tracker[todayKey] === true;

      if (!marked) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: "👀 CP Reminder",
          message: "You haven’t marked a problem as solved today. Go for 1 A/B problem 💪",
          priority: 1
        });
      }
    });
  }
});
