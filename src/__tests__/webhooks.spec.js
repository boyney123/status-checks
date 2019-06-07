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

describe("webhooks", () => {
  describe("webhook", () => {
    it("when a GitHub pull_request payload comes in the `runner` is executed with the octokit instance and payload", () => {
      const octokitMock = jest.fn();
      let simulatePullRequestEvent, webhookEvent;

      webhooks.mockImplementation(() => {
        return {
          on: (event, callback) => {
            webhookEvent = event;
            simulatePullRequestEvent = callback;
          }
        };
      });

      octokit.mockImplementation(() => {
        return octokitMock;
      });

      const app = require("../");
      const payload = { test: true };

      simulatePullRequestEvent({ id: "1", name: "test", payload });

      expect(webhooks).toHaveBeenCalledWith({ secret: "my_secret" });
      expect(webhookEvent).toEqual("pull_request");
      expect(runner).toHaveBeenCalledWith({ octokit: octokitMock, payload });
    });
  });
});
