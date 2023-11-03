import core from "@actions/core";

import Action from "./src/Action.js";

const main = async () => {
  const action = new Action(
    core.getInput("action"),
    core.getInput("file_path"),
    core.getInput("private_key"),
    core.getInput("out_file"),
  );

  try {
    await action.run();
  } catch (e) {
    core.error(e);
  }
};

main();
