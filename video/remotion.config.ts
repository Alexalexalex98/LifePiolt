import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setOverwriteOutput(true);
// Se hai già Chrome/Chromium installato puoi indicarlo con CHROME_PATH (altrimenti Remotion scarica il suo al primo render).
if (process.env.CHROME_PATH) Config.setBrowserExecutable(process.env.CHROME_PATH);
