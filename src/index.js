require("dotenv").config();

const fs = require("fs");
const path = require("path");
const runner = require("./task-runner");
const chalk = require("chalk");
const log = console.log;

const WebhooksApi = require("@octokit/webhooks");
const webhooks = new WebhooksApi({
  secret: process.env.GITHUB_SECRET
});

const Octokit = require("@octokit/rest");

const octokit = Octokit({
  secret: process.env.GITHUB_SECRET,
  auth: process.env.GITHUB_TOKEN,
  userAgent: "pullreq",
  baseUrl: "https://api.github.com"
});

webhooks.on("pull_request", async ({ id, name, payload }) => {
  try {
    log(chalk.green("New pull_request event has come in. Running tasks..."));
    runner({ octokit, payload });
  } catch (error) {
    console.log(error);
  }
});

if (process.env.NODE_ENV !== "test") {
  require("http")
    .createServer(webhooks.middleware)
    .listen(3000);
  console.log("Listening on port 3000");
}
