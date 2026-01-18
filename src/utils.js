export function showStatus(message, type) {
  const statusDiv = document.getElementById("status");
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = "block";
  const time = 5000;
  statusDiv.style.animationDuration = `${time}ms`;
  setTimeout(() => {
    statusDiv.style.display = "none";
  }, time);
}

export function toPx(value) {
  return `${value}px`;
}

export function div() {
  return document.createElement("div");
}

export function span() {
  return document.createElement("span");
}
