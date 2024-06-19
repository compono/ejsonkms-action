import core from "@actions/core";

import Action from "./src/Action.js";

const main = async () => {
  const action = new Action(
    core.getInput("action"),
    core.getInput("file-path"),
    core.getInput("aws-region"),
    core.getInput("out-file"),
    core.getInput("populate-env-vars"),
  );

  try {
    await action.run();
  } catch (e) {
    core.error(
      `[ERROR] Failure on ejsonkms ${core.getInput("action")}: ${e.message}`,
    );

    process.exit(1);
  }
};

main();
