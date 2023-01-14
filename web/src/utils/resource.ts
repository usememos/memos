export const getResourceUrl = (resource: Resource, withOrigin = true) => {
  return `${withOrigin ? window.location.origin : ""}/o/r/${resource.id}/${encodeURI(resource.filename)}`;
};
