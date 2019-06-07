module.exports = options => {
  const { setDescription } = options;

  // pretend to do something...
  const someAsyncTask = info => {
    // Update the Github status
    setDescription(info);
    return new Promise(function(resolve) {
      setTimeout(resolve, 3000);
    });
  };

  return new Promise(async (resolve, reject) => {
    await someAsyncTask("Setting up CI project...");
    await someAsyncTask("Running eslint...");
    await someAsyncTask("Running unit tests...");
    await someAsyncTask("Running e2e tests...");
    resolve("Everything passed");
  });
};
