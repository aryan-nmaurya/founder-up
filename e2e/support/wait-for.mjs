#!/usr/bin/env node
// Waits until a URL answers, then exits. Lets a second `next start` wait for
// the build the first web server runs.
const [url, timeoutSeconds = "300"] = process.argv.slice(2);
const deadline = Date.now() + Number(timeoutSeconds) * 1000;

while (Date.now() < deadline) {
  try {
    const res = await fetch(url);
    if (res.status < 500) process.exit(0);
  } catch {
    // Not up yet.
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
console.error(`Timed out waiting for ${url}`);
process.exit(1);
