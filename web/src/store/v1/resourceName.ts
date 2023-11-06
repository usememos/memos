export const UserNamePrefix = "users/";

export const extractUsernameFromName = (name: string = "") => {
  return name.slice(UserNamePrefix.length);
};
