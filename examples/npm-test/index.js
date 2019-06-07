module.exports = async options => {
  const { setDescription, runCommand } = options;

  // Updates the github status
  await setDescription("Running testing");

  try {
    // run custom script
    await runCommand("npm run test");

    // update status
    await setDescription("Npm test passed");

    // Status will be marked as successful
    return Promise.resolve();
  } catch (error) {
    // update status
    await setDescription("Failed to run test");

    // status marked as failed
    return Promise.reject();
  }
};
