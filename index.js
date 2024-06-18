import core from "@actions/core";

import Action from "./src/Action.js";

const main = async () => {
  const action = new Action(
    core.getInput("action"),
    core.getInput("file-path"),
    core.getInput("private-key"),
    core.getInput("out-file"),
  );

  try {
    await action.run();
  } catch (e) {
    core.error(
      `[ERROR] Failure on ejson ${core.getInput("action")}: ${e.message}`,
    );

    process.exit(1);
  }
};

main();
