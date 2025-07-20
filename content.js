// Runs on profile pages like codeforces.com/profile/stickydough
const url = window.location.href;
const match = url.match(/\/profile\/([^\/?#]+)/);

if (match && match[1]) {
  const handle = match[1];
  chrome.storage.local.set({ codeforcesHandle: handle });
}
