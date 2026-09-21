// Release links accept current calendar versions and historical 0.x releases.
export const isReleaseVersion = (version: string): boolean =>
  /^(?:[1-9]\d\.(?:0[1-9]|1[0-2])(?:\.[1-9]\d*)?|0\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-rc\.[1-9]\d*)?$/.test(version);
