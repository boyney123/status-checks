const octokit = require("@octokit/rest");
const webhooks = require("@octokit/webhooks");
const runner = require("../task-runner");

process.env.GITHUB_SECRET = "my_secret";
process.env.GITHUB_TOKEN = "my_token";

jest.mock("@octokit/rest", () => {
  return jest.fn();
});

jest.mock("@octokit/webhooks", () => {
  return jest.fn(() => {
    return {
      on: jest.fn()
    };
  });
});

jest.mock("../task-runner", () => {
  return jest.fn();
});

describe("pullreq", () => {
  describe("setup", () => {
    it("sets up ocotokit with the required params", () => {
      const app = require("../");
      expect(octokit).toHaveBeenCalledWith({ auth: "my_token", baseUrl: "https://api.github.com", secret: "my_secret", userAgent: "pullreq" });
    });
  });
});
