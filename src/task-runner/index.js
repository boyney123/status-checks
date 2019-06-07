const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const runCommand = require("../scripts/run-command");
const log = console.log;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const tasksDirectory = process.env.TASK_DIRECTORY || path.join(__dirname, "../tasks");

const statusUpdater = (octokit, owner, repo, sha) => (context, defaultDescription) => (state, description) => {
  return octokit.repos.createStatus({
    owner,
    repo,
    sha,
    state,
    context,
    description: description || defaultDescription
  });
};

const main = async (options = {}) => {
  const { octokit, payload, taskDir = tasksDirectory } = options;
  const { pull_request = {} } = payload;
  const { head: { sha, repo: { name, owner: { login } = {}, clone_url } = {} } = {} } = pull_request;
  const statusAPI = statusUpdater(octokit, login, name, sha);
  const updateProjectStatus = statusAPI("status-check-app", "status-check-app");

  updateProjectStatus("pending", "Checking for tasks...");

  const isDirectory = source => fs.lstatSync(source).isDirectory();
  const getDirectories = source =>
    fs
      .readdirSync(source)
      .map(name => path.join(source, name))
      .filter(isDirectory);

  const functionDirs = getDirectories(taskDir);

  if (functionDirs.length === 0) {
    log(chalk.red("No tasks found in the tasks directory. Please add some tasks to run. More can be found in the documentation website"));
    updateProjectStatus("failure", "No tasks found");
    return new Error("Please provide tasks");
  }

  const promises = functionDirs.map(dir => {
    const hasMetadata = fs.existsSync(path.join(dir, "metadata.json"));
    console.log("here", path.join(dir, "/metadata.json"), hasMetadata);
    return {
      promise: require(dir),
      metadata: hasMetadata ? require(path.join(dir, "/metadata.json")) : {},
      dir
    };
  });

  const rootDir = path.join(__dirname, "../../");
  const projectDir = path.join(rootDir, sha);

  updateProjectStatus("pending", "Cleanup and Cloning project...");
  log(chalk.green(`Cleaning up, before cloning: ${projectDir}`));
  await runCommand(`rm -rf ${sha}`, { cwd: rootDir });

  log(chalk.green(`Cloning the repo: ${projectDir}`));
  // pass token in just in case its private?
  const cloneUrl = clone_url.replace("github.com", `${GITHUB_TOKEN}@github.com`);
  await runCommand(`git clone ${cloneUrl} ${sha}`, { cwd: rootDir });

  const hasPackageJSON = fs.existsSync(path.join(projectDir, `package.json`));

  // What if not node stuff?
  if (hasPackageJSON) {
    updateProjectStatus("pending", "Installing dependencies before running tasks...");
    log(chalk.green(`Installing dependencies from package.json`));
    await runCommand(`npm install`, { cwd: projectDir });
  }

  log(chalk.green(`Running tasks...`));
  updateProjectStatus("pending", "Running tasks...");

  const allTasks = promises.map(({ promise, dir, metadata }) => {
    return new Promise(async (resolve, reject) => {
      const parts = dir.split("/");
      const func = parts[parts.length - 1];
      const { title = func, description = "Custom task" } = metadata;
      const setStatusCheck = statusAPI(title, description);
      try {
        await setStatusCheck("pending");
      } catch (error) {
        console.log("error");
      }

      try {
        log(`${chalk.blue("Running function:")} ${chalk.green(func)}`);
        const { taskDir, ...promiseArgs } = options;
        await promise({
          ...promiseArgs,
          setDescription: async description => {
            console.log('setStatusCheck("pending", description)', description);
            await setStatusCheck("pending", description);
          },
          // Api for custom tasks, run anything you want inside that folder...
          runCommand: command => {
            return runCommand(command, { cwd: path.join(rootDir, sha) });
          }
        });
        await setStatusCheck("success", "Passed");
        log(chalk.green(`Function was successful: ${func}`));
        resolve();
      } catch (error) {
        await setStatusCheck("failure");
        log(chalk.red(`Function failed: ${func}`));
        reject();
      }
    });
  });

  return Promise.all(allTasks.map(p => p.catch(e => e))).then(async results => {
    log(chalk.green("Finished running all tasks"));
    await runCommand(`rm -rf ${sha}`, { cwd: rootDir });
    await updateProjectStatus("success", "Finished running all tasks");
  });
};

module.exports = main;
