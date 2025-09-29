import core from "@actions/core";
import Action from "./Action";

const main = async () => {
  const action = new Action(
    core.getInput("action"),
    core.getInput("file-path"),
    core.getInput("aws-region"),
    core.getInput("out-file"),
    core.getInput("populate-env-vars"),
    core.getInput("prefix-env-vars"),
  );

  try {
    await action.run();
  } catch (error) {
    if (error instanceof Error) {
      core.error(
        `[ERROR] Failure on ejsonkms ${core.getInput("action")}: ${error.message}`,
      );
    }
    process.exit(1);
  }
};

main();
