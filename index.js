import core from "@actions/core";

import Action from "./src/Action.js";

const main = async () => {
  const action = new Action(
    core.getInput("action"),
    core.getInput("file_path"),
    core.getInput("private_key"),
  );

  const decrypted = await action.run();

  core.info(`Decrypted JSON: ${decrypted}`);
};

main();
