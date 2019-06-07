const runner = require("./");
const task1 = require("./mocks/example-tasks/task-1");
const task2 = require("./mocks/example-tasks/task-2");
const runCommand = require("../scripts/run-command");
const path = require("path");

const taskDir = path.join(__dirname, "./mocks/example-tasks");
const containTask = task => expect.arrayContaining([[task]]);

jest.mock("./mocks/example-tasks/task-1", () => {
  return jest.fn();
});

jest.mock("./mocks/example-tasks/task-2", () => {
  return jest.fn();
});

jest.mock("../scripts/run-command", () => {
  return jest.fn();
});

const buildRunner = async overrides => {
  const octokit = {
    repos: {
      createStatus: jest.fn()
    }
  };
  const payload = {
    pull_request: {
      head: {
        sha: "1234",
        repo: {
          name: "test-repo",
          clone_url: "https://github.com/boyney123/repo.git",
          owner: {
            login: "boyney123"
          }
        }
      }
    }
  };
  const options = { octokit, payload, taskDir, ...overrides };
  return { octokit, options, runner: await runner(options) };
};

describe("task-runner", () => {
  beforeEach(() => {
    task1.mockReset();
    task2.mockReset();
    runCommand.mockReset();
  });

  describe("setup", () => {
    it("cleans and checks-out the code of the pull request in the root directory of the project", async () => {
      await buildRunner();
      const runCommandCalls = runCommand.mock.calls;
      expect(runCommandCalls[0]).toEqual(["rm -rf 1234", { cwd: path.join(__dirname, "../../") }]);
      expect(runCommandCalls[1]).toEqual(["git clone https://token@github.com/boyney123/repo.git 1234", { cwd: path.join(__dirname, "../../") }]);
    });

    it("once all tasks have finished the clone folder is removed", async done => {
      await buildRunner();
      const runCommandCalls = runCommand.mock.calls;

      // hack, to wait for the async tasks to finish. await not working?
      setTimeout(() => {
        expect(runCommandCalls[2]).toEqual(["rm -rf 1234", { cwd: path.join(__dirname, "../../") }]);
        done();
      }, 100);
    });

    it("installs dependencies from the package.json file if it finds one after the clone process", async () => {
      const fs = require("fs");
      const old = fs.existsSync;

      fs.existsSync = jest.fn(file => {
        return file.indexOf("package.json") > -1;
      });

      await buildRunner();
      const runCommandCalls = runCommand.mock.calls;

      expect(runCommandCalls[2]).toEqual(["npm install", { cwd: path.join(__dirname, "../../1234") }]);

      fs.existsSync = old;
    });
    it("if no tasks can be found to run then it stops running and logs out an error", async () => {
      const { runner } = await buildRunner({ taskDir: path.join(__dirname, "./mocks/folder-with-no-tasks") });
      expect(runner.message).toBe("Please provide tasks");
    });
  });

  describe("status-check-app status check", () => {
    it("when the runner starts it sends a status check to GitHub to represent the checks have started", async () => {
      const { octokit } = await buildRunner();

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "status-check-app",
          description: "Checking for tasks...",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "pending"
        })
      );
    });
    it("when the runner starts to checkout and clone the project the status is sent to GitHub", async () => {
      const { octokit } = await buildRunner();

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "status-check-app",
          description: "Cleanup and Cloning project...",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "pending"
        })
      );
    });
    it("when the project has checked out and project has a package.json file a status is sent to GitHub", async () => {
      const fs = require("fs");
      const old = fs.existsSync;

      fs.existsSync = jest.fn(file => {
        return file.indexOf("package.json") > -1;
      });

      const { octokit } = await buildRunner();

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "status-check-app",
          description: "Installing dependencies before running tasks...",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "pending"
        })
      );
      fs.existsSync = old;
    });

    it("before the tasks are run the status is sent to GitHub", async () => {
      const { octokit } = await buildRunner();

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "status-check-app",
          description: "Running tasks...",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "pending"
        })
      );
    });
    it("Once all tasks have finished the status is marked as successful", async () => {
      const { octokit } = await buildRunner();

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "status-check-app",
          description: "Finished running all tasks",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "success"
        })
      );
    });
    it("when no tasks have been found the runner sends a status check to GitHub with a failure and message", async () => {
      const { octokit } = await buildRunner({ taskDir: path.join(__dirname, "./mocks/folder-with-no-tasks") });

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "status-check-app",
          description: "No tasks found",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "failure"
        })
      );
    });
  });

  describe("tasks", () => {
    it("loops through all tasks and calls them", async () => {
      await buildRunner();
      expect(task1).toHaveBeenCalled();
      expect(task2).toHaveBeenCalled();
    });

    it("sets the title and description to the default values if no `metadata` file is set", async () => {
      const { octokit } = await buildRunner();

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "task-without-metadata",
          description: "Custom task",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "pending"
        })
      );
    });
    it("before the task is called the status is set to pending", async () => {
      const { octokit } = await buildRunner();

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "task-1",
          description: "My custom task",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "pending"
        })
      );
    });
    it("sets the status to success if the task resolves", async () => {
      const { octokit } = await buildRunner();

      const octokitCalls = octokit.repos.createStatus.mock.calls;

      expect(octokitCalls).toEqual(
        containTask({
          context: "task-1",
          description: "Passed",
          owner: "boyney123",
          repo: "test-repo",
          sha: "1234",
          state: "success"
        })
      );
    });
    it("sets the status to failure if the task rejects", async done => {
      const { octokit } = await buildRunner();

      setTimeout(() => {
        const octokitCalls = octokit.repos.createStatus.mock.calls;

        expect(octokitCalls).toEqual(
          containTask({
            context: "failed-task",
            description: "Failed Task",
            owner: "boyney123",
            repo: "test-repo",
            sha: "1234",
            state: "failure"
          })
        );

        done();
      }, 1);
    });
  });

  describe("task API", () => {
    describe("runCommand", () => {
      it("when called it runs the given command in the current working directory of the cloned project", async () => {
        const { options, octokit } = await buildRunner();

        const runCommandCalls = runCommand.mock.calls;

        const task1Args = task1.mock.calls[0][0];

        await task1Args.runCommand("echo Hello");

        expect(runCommandCalls[3][0]).toEqual("echo Hello");
      });
    });
    describe("setDescription", () => {
      it("when called it sets setDescription of the status check", async () => {
        const { options, octokit } = await buildRunner();

        const octokitCalls = octokit.repos.createStatus.mock.calls;

        const task1Args = task1.mock.calls[0][0];

        await task1Args.setDescription("Here is an update on my description");

        expect(octokitCalls).toEqual(
          containTask({
            context: "task-1",
            description: "Here is an update on my description",
            owner: "boyney123",
            repo: "test-repo",
            sha: "1234",
            state: "pending"
          })
        );
      });
    });

    it("each task that gets called gets called with an API", async () => {
      const { options } = await buildRunner();

      const task1Args = task1.mock.calls[0][0];

      const { taskDir: _taskDir, ...expectedArgsForPromise } = options;

      expect(task1Args).toEqual(expect.objectContaining({ ...expectedArgsForPromise }));
      expect(task1Args.setDescription).toBeDefined();
      expect(task1Args.runCommand).toBeDefined();
      expect(Object.keys(task1Args)).toHaveLength(4);
    });
  });
});
