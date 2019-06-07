const { exec } = require("child-process-promise");
const logUpdate = require("log-update");
const { dots } = require("cli-spinners");
const chalk = require("chalk");

const logPromise = async (promise, text, isLongRunningTask = false) => {
  const { frames, interval } = dots;

  let index = 0;

  const inProgressMessage = `- this may take a few ${isLongRunningTask ? "minutes" : "seconds"}`;

  const id = setInterval(() => {
    index = ++index % frames.length;
    logUpdate(`${chalk.yellow(frames[index])} ${text} ${chalk.gray(inProgressMessage)}`);
  }, interval);

  try {
    const returnValue = await promise;

    clearInterval(id);

    logUpdate(`${chalk.green("✓")} ${text}`);
    logUpdate.done();

    return returnValue;
  } catch (error) {
    logUpdate.clear();

    throw error;
  }
};

const runCommand = async (command, options) => {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await exec(command, options);
      const { stdout, stderr } = result;
      console.log(stdout);
      console.log(stderr);
      resolve();
    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
};

module.exports = runCommand;
