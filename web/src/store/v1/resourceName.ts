export const UserNamePrefix = "users/";

export const extractUsernameFromName = (name: string) => {
  return name.split("/")[1];
};
