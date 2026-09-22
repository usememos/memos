// Release links accept current calendar versions and historical 0.x releases.
const isReleaseVersion = (version: string): boolean =>
  /^(?:[1-9]\d\.(?:0[1-9]|1[0-2])(?:\.[1-9]\d*)?|0\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-rc\.[1-9]\d*)?$/.test(version);

export const getReleaseTag = (version: string): string | undefined => {
  if (!isReleaseVersion(version)) return undefined;
  return version.startsWith("0.") ? `v${version}` : version;
};
