export const getResourceUrl = (resource: Resource, withOrigin = true) => {
  if (resource.externalLink) {
    return resource.externalLink;
  }

  return `${withOrigin ? window.location.origin : ""}/o/r/${resource.id}`;
};

export const getResourceType = (resource: Resource) => {
  if (resource.type.startsWith("image") && isImage(resource.type)) {
    return "image/*";
  } else if (resource.type.startsWith("video")) {
    return "video/*";
  } else if (resource.type.startsWith("audio")) {
    return "audio/*";
  } else if (resource.type.startsWith("text")) {
    return "text/*";
  } else if (resource.type.startsWith("application/epub+zip")) {
    return "application/epub+zip";
  } else if (resource.type.startsWith("application/pdf")) {
    return "application/pdf";
  } else if (resource.type.includes("word")) {
    return "application/msword";
  } else if (resource.type.includes("excel")) {
    return "application/msexcel";
  } else if (resource.type.startsWith("application/zip")) {
    return "application/zip";
  } else if (resource.type.startsWith("application/x-java-archive")) {
    return "application/x-java-archive";
  } else {
    return "application/octet-stream";
  }
};

// isImage returns true if the given mime type is an image.
export const isImage = (t: string) => {
  return t === "image/jpeg" || t === "image/png" || t === "image/gif" || t === "image/svg+xml" || t === "image/webp";
};
