import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { findManagedResource, isFieldManaged } from "@/hooks/useConfigurationQueries";
import { ConfigurationStatus_ManagedResourceSchema, ConfigurationStatusSchema } from "@/types/proto/api/instance_service_pb";

describe("isFieldManaged", () => {
  const general = create(ConfigurationStatus_ManagedResourceSchema, {
    resource: "instance/settings/GENERAL",
    managedFields: ["*"],
    ignoredFields: ["generalSetting.customProfile"],
  });
  const user = create(ConfigurationStatus_ManagedResourceSchema, { resource: "users/admin", managedFields: ["username", "role"] });

  it("follows the managed and ignored paths the server enforces", () => {
    expect(isFieldManaged(general, "generalSetting.disallowPasswordAuth")).toBe(true);
    expect(isFieldManaged(general, "generalSetting.customProfile")).toBe(false);
    expect(isFieldManaged(general, "generalSetting.customProfile.title")).toBe(false);
    expect(isFieldManaged(user, "role")).toBe(true);
    expect(isFieldManaged(user, "displayName")).toBe(false);
    expect(isFieldManaged(undefined, "role")).toBe(false);
  });

  it("finds a managed resource by name", () => {
    const status = create(ConfigurationStatusSchema, { managedResources: [general, user] });
    expect(findManagedResource(status, "users/admin")).toBe(user);
    expect(findManagedResource(status, "users/jane")).toBeUndefined();
    expect(findManagedResource(undefined, "users/admin")).toBeUndefined();
  });
});
