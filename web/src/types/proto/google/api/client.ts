/* eslint-disable */
import _m0 from "protobufjs/minimal";
import { Duration } from "../protobuf/duration";
import { LaunchStage } from "./launch_stage";

export const protobufPackage = "google.api";

/**
 * The organization for which the client libraries are being published.
 * Affects the url where generated docs are published, etc.
 */
export enum ClientLibraryOrganization {
  /** CLIENT_LIBRARY_ORGANIZATION_UNSPECIFIED - Not useful. */
  CLIENT_LIBRARY_ORGANIZATION_UNSPECIFIED = 0,
  /** CLOUD - Google Cloud Platform Org. */
  CLOUD = 1,
  /** ADS - Ads (Advertising) Org. */
  ADS = 2,
  /** PHOTOS - Photos Org. */
  PHOTOS = 3,
  /** STREET_VIEW - Street View Org. */
  STREET_VIEW = 4,
  /** SHOPPING - Shopping Org. */
  SHOPPING = 5,
  /** GEO - Geo Org. */
  GEO = 6,
  /** GENERATIVE_AI - Generative AI - https://developers.generativeai.google */
  GENERATIVE_AI = 7,
  UNRECOGNIZED = -1,
}

/** To where should client libraries be published? */
export enum ClientLibraryDestination {
  /**
   * CLIENT_LIBRARY_DESTINATION_UNSPECIFIED - Client libraries will neither be generated nor published to package
   * managers.
   */
  CLIENT_LIBRARY_DESTINATION_UNSPECIFIED = 0,
  /**
   * GITHUB - Generate the client library in a repo under github.com/googleapis,
   * but don't publish it to package managers.
   */
  GITHUB = 10,
  /** PACKAGE_MANAGER - Publish the library to package managers like nuget.org and npmjs.com. */
  PACKAGE_MANAGER = 20,
  UNRECOGNIZED = -1,
}

/** Required information for every language. */
export interface CommonLanguageSettings {
  /**
   * Link to automatically generated reference documentation.  Example:
   * https://cloud.google.com/nodejs/docs/reference/asset/latest
   *
   * @deprecated
   */
  referenceDocsUri: string;
  /** The destination where API teams want this client library to be published. */
  destinations: ClientLibraryDestination[];
}

/** Details about how and where to publish client libraries. */
export interface ClientLibrarySettings {
  /**
   * Version of the API to apply these settings to. This is the full protobuf
   * package for the API, ending in the version element.
   * Examples: "google.cloud.speech.v1" and "google.spanner.admin.database.v1".
   */
  version: string;
  /** Launch stage of this version of the API. */
  launchStage: LaunchStage;
  /**
   * When using transport=rest, the client request will encode enums as
   * numbers rather than strings.
   */
  restNumericEnums: boolean;
  /** Settings for legacy Java features, supported in the Service YAML. */
  javaSettings?:
    | JavaSettings
    | undefined;
  /** Settings for C++ client libraries. */
  cppSettings?:
    | CppSettings
    | undefined;
  /** Settings for PHP client libraries. */
  phpSettings?:
    | PhpSettings
    | undefined;
  /** Settings for Python client libraries. */
  pythonSettings?:
    | PythonSettings
    | undefined;
  /** Settings for Node client libraries. */
  nodeSettings?:
    | NodeSettings
    | undefined;
  /** Settings for .NET client libraries. */
  dotnetSettings?:
    | DotnetSettings
    | undefined;
  /** Settings for Ruby client libraries. */
  rubySettings?:
    | RubySettings
    | undefined;
  /** Settings for Go client libraries. */
  goSettings?: GoSettings | undefined;
}

/**
 * This message configures the settings for publishing [Google Cloud Client
 * libraries](https://cloud.google.com/apis/docs/cloud-client-libraries)
 * generated from the service config.
 */
export interface Publishing {
  /**
   * A list of API method settings, e.g. the behavior for methods that use the
   * long-running operation pattern.
   */
  methodSettings: MethodSettings[];
  /**
   * Link to a *public* URI where users can report issues.  Example:
   * https://issuetracker.google.com/issues/new?component=190865&template=1161103
   */
  newIssueUri: string;
  /**
   * Link to product home page.  Example:
   * https://cloud.google.com/asset-inventory/docs/overview
   */
  documentationUri: string;
  /**
   * Used as a tracking tag when collecting data about the APIs developer
   * relations artifacts like docs, packages delivered to package managers,
   * etc.  Example: "speech".
   */
  apiShortName: string;
  /** GitHub label to apply to issues and pull requests opened for this API. */
  githubLabel: string;
  /**
   * GitHub teams to be added to CODEOWNERS in the directory in GitHub
   * containing source code for the client libraries for this API.
   */
  codeownerGithubTeams: string[];
  /**
   * A prefix used in sample code when demarking regions to be included in
   * documentation.
   */
  docTagPrefix: string;
  /** For whom the client library is being published. */
  organization: ClientLibraryOrganization;
  /**
   * Client library settings.  If the same version string appears multiple
   * times in this list, then the last one wins.  Settings from earlier
   * settings with the same version string are discarded.
   */
  librarySettings: ClientLibrarySettings[];
  /**
   * Optional link to proto reference documentation.  Example:
   * https://cloud.google.com/pubsub/lite/docs/reference/rpc
   */
  protoReferenceDocumentationUri: string;
}

/** Settings for Java client libraries. */
export interface JavaSettings {
  /**
   * The package name to use in Java. Clobbers the java_package option
   * set in the protobuf. This should be used **only** by APIs
   * who have already set the language_settings.java.package_name" field
   * in gapic.yaml. API teams should use the protobuf java_package option
   * where possible.
   *
   * Example of a YAML configuration::
   *
   *  publishing:
   *    java_settings:
   *      library_package: com.google.cloud.pubsub.v1
   */
  libraryPackage: string;
  /**
   * Configure the Java class name to use instead of the service's for its
   * corresponding generated GAPIC client. Keys are fully-qualified
   * service names as they appear in the protobuf (including the full
   * the language_settings.java.interface_names" field in gapic.yaml. API
   * teams should otherwise use the service name as it appears in the
   * protobuf.
   *
   * Example of a YAML configuration::
   *
   *  publishing:
   *    java_settings:
   *      service_class_names:
   *        - google.pubsub.v1.Publisher: TopicAdmin
   *        - google.pubsub.v1.Subscriber: SubscriptionAdmin
   */
  serviceClassNames: { [key: string]: string };
  /** Some settings. */
  common?: CommonLanguageSettings | undefined;
}

export interface JavaSettings_ServiceClassNamesEntry {
  key: string;
  value: string;
}

/** Settings for C++ client libraries. */
export interface CppSettings {
  /** Some settings. */
  common?: CommonLanguageSettings | undefined;
}

/** Settings for Php client libraries. */
export interface PhpSettings {
  /** Some settings. */
  common?: CommonLanguageSettings | undefined;
}

/** Settings for Python client libraries. */
export interface PythonSettings {
  /** Some settings. */
  common?: CommonLanguageSettings | undefined;
}

/** Settings for Node client libraries. */
export interface NodeSettings {
  /** Some settings. */
  common?: CommonLanguageSettings | undefined;
}

/** Settings for Dotnet client libraries. */
export interface DotnetSettings {
  /** Some settings. */
  common?:
    | CommonLanguageSettings
    | undefined;
  /**
   * Map from original service names to renamed versions.
   * This is used when the default generated types
   * would cause a naming conflict. (Neither name is
   * fully-qualified.)
   * Example: Subscriber to SubscriberServiceApi.
   */
  renamedServices: { [key: string]: string };
  /**
   * Map from full resource types to the effective short name
   * for the resource. This is used when otherwise resource
   * named from different services would cause naming collisions.
   * Example entry:
   * "datalabeling.googleapis.com/Dataset": "DataLabelingDataset"
   */
  renamedResources: { [key: string]: string };
  /**
   * List of full resource types to ignore during generation.
   * This is typically used for API-specific Location resources,
   * which should be handled by the generator as if they were actually
   * the common Location resources.
   * Example entry: "documentai.googleapis.com/Location"
   */
  ignoredResources: string[];
  /**
   * Namespaces which must be aliased in snippets due to
   * a known (but non-generator-predictable) naming collision
   */
  forcedNamespaceAliases: string[];
  /**
   * Method signatures (in the form "service.method(signature)")
   * which are provided separately, so shouldn't be generated.
   * Snippets *calling* these methods are still generated, however.
   */
  handwrittenSignatures: string[];
}

export interface DotnetSettings_RenamedServicesEntry {
  key: string;
  value: string;
}

export interface DotnetSettings_RenamedResourcesEntry {
  key: string;
  value: string;
}

/** Settings for Ruby client libraries. */
export interface RubySettings {
  /** Some settings. */
  common?: CommonLanguageSettings | undefined;
}

/** Settings for Go client libraries. */
export interface GoSettings {
  /** Some settings. */
  common?: CommonLanguageSettings | undefined;
}

/** Describes the generator configuration for a method. */
export interface MethodSettings {
  /**
   * The fully qualified name of the method, for which the options below apply.
   * This is used to find the method to apply the options.
   */
  selector: string;
  /**
   * Describes settings to use for long-running operations when generating
   * API methods for RPCs. Complements RPCs that use the annotations in
   * google/longrunning/operations.proto.
   *
   * Example of a YAML configuration::
   *
   *  publishing:
   *    method_settings:
   *      - selector: google.cloud.speech.v2.Speech.BatchRecognize
   *        long_running:
   *          initial_poll_delay:
   *            seconds: 60 # 1 minute
   *          poll_delay_multiplier: 1.5
   *          max_poll_delay:
   *            seconds: 360 # 6 minutes
   *          total_poll_timeout:
   *             seconds: 54000 # 90 minutes
   */
  longRunning?: MethodSettings_LongRunning | undefined;
}

/**
 * Describes settings to use when generating API methods that use the
 * long-running operation pattern.
 * All default values below are from those used in the client library
 * generators (e.g.
 * [Java](https://github.com/googleapis/gapic-generator-java/blob/04c2faa191a9b5a10b92392fe8482279c4404803/src/main/java/com/google/api/generator/gapic/composer/common/RetrySettingsComposer.java)).
 */
export interface MethodSettings_LongRunning {
  /**
   * Initial delay after which the first poll request will be made.
   * Default value: 5 seconds.
   */
  initialPollDelay?:
    | Duration
    | undefined;
  /**
   * Multiplier to gradually increase delay between subsequent polls until it
   * reaches max_poll_delay.
   * Default value: 1.5.
   */
  pollDelayMultiplier: number;
  /**
   * Maximum time between two subsequent poll requests.
   * Default value: 45 seconds.
   */
  maxPollDelay?:
    | Duration
    | undefined;
  /**
   * Total polling timeout.
   * Default value: 5 minutes.
   */
  totalPollTimeout?: Duration | undefined;
}

function createBaseCommonLanguageSettings(): CommonLanguageSettings {
  return { referenceDocsUri: "", destinations: [] };
}

export const CommonLanguageSettings = {
  encode(message: CommonLanguageSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.referenceDocsUri !== "") {
      writer.uint32(10).string(message.referenceDocsUri);
    }
    writer.uint32(18).fork();
    for (const v of message.destinations) {
      writer.int32(v);
    }
    writer.ldelim();
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CommonLanguageSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCommonLanguageSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.referenceDocsUri = reader.string();
          continue;
        case 2:
          if (tag === 16) {
            message.destinations.push(reader.int32() as any);

            continue;
          }

          if (tag === 18) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.destinations.push(reader.int32() as any);
            }

            continue;
          }

          break;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<CommonLanguageSettings>): CommonLanguageSettings {
    return CommonLanguageSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CommonLanguageSettings>): CommonLanguageSettings {
    const message = createBaseCommonLanguageSettings();
    message.referenceDocsUri = object.referenceDocsUri ?? "";
    message.destinations = object.destinations?.map((e) => e) || [];
    return message;
  },
};

function createBaseClientLibrarySettings(): ClientLibrarySettings {
  return {
    version: "",
    launchStage: 0,
    restNumericEnums: false,
    javaSettings: undefined,
    cppSettings: undefined,
    phpSettings: undefined,
    pythonSettings: undefined,
    nodeSettings: undefined,
    dotnetSettings: undefined,
    rubySettings: undefined,
    goSettings: undefined,
  };
}

export const ClientLibrarySettings = {
  encode(message: ClientLibrarySettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.version !== "") {
      writer.uint32(10).string(message.version);
    }
    if (message.launchStage !== 0) {
      writer.uint32(16).int32(message.launchStage);
    }
    if (message.restNumericEnums === true) {
      writer.uint32(24).bool(message.restNumericEnums);
    }
    if (message.javaSettings !== undefined) {
      JavaSettings.encode(message.javaSettings, writer.uint32(170).fork()).ldelim();
    }
    if (message.cppSettings !== undefined) {
      CppSettings.encode(message.cppSettings, writer.uint32(178).fork()).ldelim();
    }
    if (message.phpSettings !== undefined) {
      PhpSettings.encode(message.phpSettings, writer.uint32(186).fork()).ldelim();
    }
    if (message.pythonSettings !== undefined) {
      PythonSettings.encode(message.pythonSettings, writer.uint32(194).fork()).ldelim();
    }
    if (message.nodeSettings !== undefined) {
      NodeSettings.encode(message.nodeSettings, writer.uint32(202).fork()).ldelim();
    }
    if (message.dotnetSettings !== undefined) {
      DotnetSettings.encode(message.dotnetSettings, writer.uint32(210).fork()).ldelim();
    }
    if (message.rubySettings !== undefined) {
      RubySettings.encode(message.rubySettings, writer.uint32(218).fork()).ldelim();
    }
    if (message.goSettings !== undefined) {
      GoSettings.encode(message.goSettings, writer.uint32(226).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ClientLibrarySettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseClientLibrarySettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.version = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.launchStage = reader.int32() as any;
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.restNumericEnums = reader.bool();
          continue;
        case 21:
          if (tag !== 170) {
            break;
          }

          message.javaSettings = JavaSettings.decode(reader, reader.uint32());
          continue;
        case 22:
          if (tag !== 178) {
            break;
          }

          message.cppSettings = CppSettings.decode(reader, reader.uint32());
          continue;
        case 23:
          if (tag !== 186) {
            break;
          }

          message.phpSettings = PhpSettings.decode(reader, reader.uint32());
          continue;
        case 24:
          if (tag !== 194) {
            break;
          }

          message.pythonSettings = PythonSettings.decode(reader, reader.uint32());
          continue;
        case 25:
          if (tag !== 202) {
            break;
          }

          message.nodeSettings = NodeSettings.decode(reader, reader.uint32());
          continue;
        case 26:
          if (tag !== 210) {
            break;
          }

          message.dotnetSettings = DotnetSettings.decode(reader, reader.uint32());
          continue;
        case 27:
          if (tag !== 218) {
            break;
          }

          message.rubySettings = RubySettings.decode(reader, reader.uint32());
          continue;
        case 28:
          if (tag !== 226) {
            break;
          }

          message.goSettings = GoSettings.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ClientLibrarySettings>): ClientLibrarySettings {
    return ClientLibrarySettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ClientLibrarySettings>): ClientLibrarySettings {
    const message = createBaseClientLibrarySettings();
    message.version = object.version ?? "";
    message.launchStage = object.launchStage ?? 0;
    message.restNumericEnums = object.restNumericEnums ?? false;
    message.javaSettings = (object.javaSettings !== undefined && object.javaSettings !== null)
      ? JavaSettings.fromPartial(object.javaSettings)
      : undefined;
    message.cppSettings = (object.cppSettings !== undefined && object.cppSettings !== null)
      ? CppSettings.fromPartial(object.cppSettings)
      : undefined;
    message.phpSettings = (object.phpSettings !== undefined && object.phpSettings !== null)
      ? PhpSettings.fromPartial(object.phpSettings)
      : undefined;
    message.pythonSettings = (object.pythonSettings !== undefined && object.pythonSettings !== null)
      ? PythonSettings.fromPartial(object.pythonSettings)
      : undefined;
    message.nodeSettings = (object.nodeSettings !== undefined && object.nodeSettings !== null)
      ? NodeSettings.fromPartial(object.nodeSettings)
      : undefined;
    message.dotnetSettings = (object.dotnetSettings !== undefined && object.dotnetSettings !== null)
      ? DotnetSettings.fromPartial(object.dotnetSettings)
      : undefined;
    message.rubySettings = (object.rubySettings !== undefined && object.rubySettings !== null)
      ? RubySettings.fromPartial(object.rubySettings)
      : undefined;
    message.goSettings = (object.goSettings !== undefined && object.goSettings !== null)
      ? GoSettings.fromPartial(object.goSettings)
      : undefined;
    return message;
  },
};

function createBasePublishing(): Publishing {
  return {
    methodSettings: [],
    newIssueUri: "",
    documentationUri: "",
    apiShortName: "",
    githubLabel: "",
    codeownerGithubTeams: [],
    docTagPrefix: "",
    organization: 0,
    librarySettings: [],
    protoReferenceDocumentationUri: "",
  };
}

export const Publishing = {
  encode(message: Publishing, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.methodSettings) {
      MethodSettings.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.newIssueUri !== "") {
      writer.uint32(810).string(message.newIssueUri);
    }
    if (message.documentationUri !== "") {
      writer.uint32(818).string(message.documentationUri);
    }
    if (message.apiShortName !== "") {
      writer.uint32(826).string(message.apiShortName);
    }
    if (message.githubLabel !== "") {
      writer.uint32(834).string(message.githubLabel);
    }
    for (const v of message.codeownerGithubTeams) {
      writer.uint32(842).string(v!);
    }
    if (message.docTagPrefix !== "") {
      writer.uint32(850).string(message.docTagPrefix);
    }
    if (message.organization !== 0) {
      writer.uint32(856).int32(message.organization);
    }
    for (const v of message.librarySettings) {
      ClientLibrarySettings.encode(v!, writer.uint32(874).fork()).ldelim();
    }
    if (message.protoReferenceDocumentationUri !== "") {
      writer.uint32(882).string(message.protoReferenceDocumentationUri);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Publishing {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePublishing();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 2:
          if (tag !== 18) {
            break;
          }

          message.methodSettings.push(MethodSettings.decode(reader, reader.uint32()));
          continue;
        case 101:
          if (tag !== 810) {
            break;
          }

          message.newIssueUri = reader.string();
          continue;
        case 102:
          if (tag !== 818) {
            break;
          }

          message.documentationUri = reader.string();
          continue;
        case 103:
          if (tag !== 826) {
            break;
          }

          message.apiShortName = reader.string();
          continue;
        case 104:
          if (tag !== 834) {
            break;
          }

          message.githubLabel = reader.string();
          continue;
        case 105:
          if (tag !== 842) {
            break;
          }

          message.codeownerGithubTeams.push(reader.string());
          continue;
        case 106:
          if (tag !== 850) {
            break;
          }

          message.docTagPrefix = reader.string();
          continue;
        case 107:
          if (tag !== 856) {
            break;
          }

          message.organization = reader.int32() as any;
          continue;
        case 109:
          if (tag !== 874) {
            break;
          }

          message.librarySettings.push(ClientLibrarySettings.decode(reader, reader.uint32()));
          continue;
        case 110:
          if (tag !== 882) {
            break;
          }

          message.protoReferenceDocumentationUri = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<Publishing>): Publishing {
    return Publishing.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Publishing>): Publishing {
    const message = createBasePublishing();
    message.methodSettings = object.methodSettings?.map((e) => MethodSettings.fromPartial(e)) || [];
    message.newIssueUri = object.newIssueUri ?? "";
    message.documentationUri = object.documentationUri ?? "";
    message.apiShortName = object.apiShortName ?? "";
    message.githubLabel = object.githubLabel ?? "";
    message.codeownerGithubTeams = object.codeownerGithubTeams?.map((e) => e) || [];
    message.docTagPrefix = object.docTagPrefix ?? "";
    message.organization = object.organization ?? 0;
    message.librarySettings = object.librarySettings?.map((e) => ClientLibrarySettings.fromPartial(e)) || [];
    message.protoReferenceDocumentationUri = object.protoReferenceDocumentationUri ?? "";
    return message;
  },
};

function createBaseJavaSettings(): JavaSettings {
  return { libraryPackage: "", serviceClassNames: {}, common: undefined };
}

export const JavaSettings = {
  encode(message: JavaSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.libraryPackage !== "") {
      writer.uint32(10).string(message.libraryPackage);
    }
    Object.entries(message.serviceClassNames).forEach(([key, value]) => {
      JavaSettings_ServiceClassNamesEntry.encode({ key: key as any, value }, writer.uint32(18).fork()).ldelim();
    });
    if (message.common !== undefined) {
      CommonLanguageSettings.encode(message.common, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): JavaSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseJavaSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.libraryPackage = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          const entry2 = JavaSettings_ServiceClassNamesEntry.decode(reader, reader.uint32());
          if (entry2.value !== undefined) {
            message.serviceClassNames[entry2.key] = entry2.value;
          }
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.common = CommonLanguageSettings.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<JavaSettings>): JavaSettings {
    return JavaSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<JavaSettings>): JavaSettings {
    const message = createBaseJavaSettings();
    message.libraryPackage = object.libraryPackage ?? "";
    message.serviceClassNames = Object.entries(object.serviceClassNames ?? {}).reduce<{ [key: string]: string }>(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = String(value);
        }
        return acc;
      },
      {},
    );
    message.common = (object.common !== undefined && object.common !== null)
      ? CommonLanguageSettings.fromPartial(object.common)
      : undefined;
    return message;
  },
};

function createBaseJavaSettings_ServiceClassNamesEntry(): JavaSettings_ServiceClassNamesEntry {
  return { key: "", value: "" };
}

export const JavaSettings_ServiceClassNamesEntry = {
  encode(message: JavaSettings_ServiceClassNamesEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): JavaSettings_ServiceClassNamesEntry {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseJavaSettings_ServiceClassNamesEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.key = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.value = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<JavaSettings_ServiceClassNamesEntry>): JavaSettings_ServiceClassNamesEntry {
    return JavaSettings_ServiceClassNamesEntry.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<JavaSettings_ServiceClassNamesEntry>): JavaSettings_ServiceClassNamesEntry {
    const message = createBaseJavaSettings_ServiceClassNamesEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

function createBaseCppSettings(): CppSettings {
  return { common: undefined };
}

export const CppSettings = {
  encode(message: CppSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.common !== undefined) {
      CommonLanguageSettings.encode(message.common, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CppSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCppSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.common = CommonLanguageSettings.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<CppSettings>): CppSettings {
    return CppSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CppSettings>): CppSettings {
    const message = createBaseCppSettings();
    message.common = (object.common !== undefined && object.common !== null)
      ? CommonLanguageSettings.fromPartial(object.common)
      : undefined;
    return message;
  },
};

function createBasePhpSettings(): PhpSettings {
  return { common: undefined };
}

export const PhpSettings = {
  encode(message: PhpSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.common !== undefined) {
      CommonLanguageSettings.encode(message.common, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PhpSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePhpSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.common = CommonLanguageSettings.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<PhpSettings>): PhpSettings {
    return PhpSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<PhpSettings>): PhpSettings {
    const message = createBasePhpSettings();
    message.common = (object.common !== undefined && object.common !== null)
      ? CommonLanguageSettings.fromPartial(object.common)
      : undefined;
    return message;
  },
};

function createBasePythonSettings(): PythonSettings {
  return { common: undefined };
}

export const PythonSettings = {
  encode(message: PythonSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.common !== undefined) {
      CommonLanguageSettings.encode(message.common, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PythonSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePythonSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.common = CommonLanguageSettings.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<PythonSettings>): PythonSettings {
    return PythonSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<PythonSettings>): PythonSettings {
    const message = createBasePythonSettings();
    message.common = (object.common !== undefined && object.common !== null)
      ? CommonLanguageSettings.fromPartial(object.common)
      : undefined;
    return message;
  },
};

function createBaseNodeSettings(): NodeSettings {
  return { common: undefined };
}

export const NodeSettings = {
  encode(message: NodeSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.common !== undefined) {
      CommonLanguageSettings.encode(message.common, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): NodeSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseNodeSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.common = CommonLanguageSettings.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<NodeSettings>): NodeSettings {
    return NodeSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<NodeSettings>): NodeSettings {
    const message = createBaseNodeSettings();
    message.common = (object.common !== undefined && object.common !== null)
      ? CommonLanguageSettings.fromPartial(object.common)
      : undefined;
    return message;
  },
};

function createBaseDotnetSettings(): DotnetSettings {
  return {
    common: undefined,
    renamedServices: {},
    renamedResources: {},
    ignoredResources: [],
    forcedNamespaceAliases: [],
    handwrittenSignatures: [],
  };
}

export const DotnetSettings = {
  encode(message: DotnetSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.common !== undefined) {
      CommonLanguageSettings.encode(message.common, writer.uint32(10).fork()).ldelim();
    }
    Object.entries(message.renamedServices).forEach(([key, value]) => {
      DotnetSettings_RenamedServicesEntry.encode({ key: key as any, value }, writer.uint32(18).fork()).ldelim();
    });
    Object.entries(message.renamedResources).forEach(([key, value]) => {
      DotnetSettings_RenamedResourcesEntry.encode({ key: key as any, value }, writer.uint32(26).fork()).ldelim();
    });
    for (const v of message.ignoredResources) {
      writer.uint32(34).string(v!);
    }
    for (const v of message.forcedNamespaceAliases) {
      writer.uint32(42).string(v!);
    }
    for (const v of message.handwrittenSignatures) {
      writer.uint32(50).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DotnetSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDotnetSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.common = CommonLanguageSettings.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          const entry2 = DotnetSettings_RenamedServicesEntry.decode(reader, reader.uint32());
          if (entry2.value !== undefined) {
            message.renamedServices[entry2.key] = entry2.value;
          }
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          const entry3 = DotnetSettings_RenamedResourcesEntry.decode(reader, reader.uint32());
          if (entry3.value !== undefined) {
            message.renamedResources[entry3.key] = entry3.value;
          }
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.ignoredResources.push(reader.string());
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.forcedNamespaceAliases.push(reader.string());
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.handwrittenSignatures.push(reader.string());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<DotnetSettings>): DotnetSettings {
    return DotnetSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DotnetSettings>): DotnetSettings {
    const message = createBaseDotnetSettings();
    message.common = (object.common !== undefined && object.common !== null)
      ? CommonLanguageSettings.fromPartial(object.common)
      : undefined;
    message.renamedServices = Object.entries(object.renamedServices ?? {}).reduce<{ [key: string]: string }>(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = String(value);
        }
        return acc;
      },
      {},
    );
    message.renamedResources = Object.entries(object.renamedResources ?? {}).reduce<{ [key: string]: string }>(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = String(value);
        }
        return acc;
      },
      {},
    );
    message.ignoredResources = object.ignoredResources?.map((e) => e) || [];
    message.forcedNamespaceAliases = object.forcedNamespaceAliases?.map((e) => e) || [];
    message.handwrittenSignatures = object.handwrittenSignatures?.map((e) => e) || [];
    return message;
  },
};

function createBaseDotnetSettings_RenamedServicesEntry(): DotnetSettings_RenamedServicesEntry {
  return { key: "", value: "" };
}

export const DotnetSettings_RenamedServicesEntry = {
  encode(message: DotnetSettings_RenamedServicesEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DotnetSettings_RenamedServicesEntry {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDotnetSettings_RenamedServicesEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.key = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.value = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<DotnetSettings_RenamedServicesEntry>): DotnetSettings_RenamedServicesEntry {
    return DotnetSettings_RenamedServicesEntry.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DotnetSettings_RenamedServicesEntry>): DotnetSettings_RenamedServicesEntry {
    const message = createBaseDotnetSettings_RenamedServicesEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

function createBaseDotnetSettings_RenamedResourcesEntry(): DotnetSettings_RenamedResourcesEntry {
  return { key: "", value: "" };
}

export const DotnetSettings_RenamedResourcesEntry = {
  encode(message: DotnetSettings_RenamedResourcesEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DotnetSettings_RenamedResourcesEntry {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDotnetSettings_RenamedResourcesEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.key = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.value = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<DotnetSettings_RenamedResourcesEntry>): DotnetSettings_RenamedResourcesEntry {
    return DotnetSettings_RenamedResourcesEntry.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DotnetSettings_RenamedResourcesEntry>): DotnetSettings_RenamedResourcesEntry {
    const message = createBaseDotnetSettings_RenamedResourcesEntry();
    message.key = object.key ?? "";
    message.value = object.value ?? "";
    return message;
  },
};

function createBaseRubySettings(): RubySettings {
  return { common: undefined };
}

export const RubySettings = {
  encode(message: RubySettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.common !== undefined) {
      CommonLanguageSettings.encode(message.common, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RubySettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRubySettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.common = CommonLanguageSettings.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<RubySettings>): RubySettings {
    return RubySettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<RubySettings>): RubySettings {
    const message = createBaseRubySettings();
    message.common = (object.common !== undefined && object.common !== null)
      ? CommonLanguageSettings.fromPartial(object.common)
      : undefined;
    return message;
  },
};

function createBaseGoSettings(): GoSettings {
  return { common: undefined };
}

export const GoSettings = {
  encode(message: GoSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.common !== undefined) {
      CommonLanguageSettings.encode(message.common, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GoSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGoSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.common = CommonLanguageSettings.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<GoSettings>): GoSettings {
    return GoSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GoSettings>): GoSettings {
    const message = createBaseGoSettings();
    message.common = (object.common !== undefined && object.common !== null)
      ? CommonLanguageSettings.fromPartial(object.common)
      : undefined;
    return message;
  },
};

function createBaseMethodSettings(): MethodSettings {
  return { selector: "", longRunning: undefined };
}

export const MethodSettings = {
  encode(message: MethodSettings, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.selector !== "") {
      writer.uint32(10).string(message.selector);
    }
    if (message.longRunning !== undefined) {
      MethodSettings_LongRunning.encode(message.longRunning, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): MethodSettings {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMethodSettings();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.selector = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.longRunning = MethodSettings_LongRunning.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<MethodSettings>): MethodSettings {
    return MethodSettings.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<MethodSettings>): MethodSettings {
    const message = createBaseMethodSettings();
    message.selector = object.selector ?? "";
    message.longRunning = (object.longRunning !== undefined && object.longRunning !== null)
      ? MethodSettings_LongRunning.fromPartial(object.longRunning)
      : undefined;
    return message;
  },
};

function createBaseMethodSettings_LongRunning(): MethodSettings_LongRunning {
  return { initialPollDelay: undefined, pollDelayMultiplier: 0, maxPollDelay: undefined, totalPollTimeout: undefined };
}

export const MethodSettings_LongRunning = {
  encode(message: MethodSettings_LongRunning, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.initialPollDelay !== undefined) {
      Duration.encode(message.initialPollDelay, writer.uint32(10).fork()).ldelim();
    }
    if (message.pollDelayMultiplier !== 0) {
      writer.uint32(21).float(message.pollDelayMultiplier);
    }
    if (message.maxPollDelay !== undefined) {
      Duration.encode(message.maxPollDelay, writer.uint32(26).fork()).ldelim();
    }
    if (message.totalPollTimeout !== undefined) {
      Duration.encode(message.totalPollTimeout, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): MethodSettings_LongRunning {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMethodSettings_LongRunning();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.initialPollDelay = Duration.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 21) {
            break;
          }

          message.pollDelayMultiplier = reader.float();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.maxPollDelay = Duration.decode(reader, reader.uint32());
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.totalPollTimeout = Duration.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<MethodSettings_LongRunning>): MethodSettings_LongRunning {
    return MethodSettings_LongRunning.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<MethodSettings_LongRunning>): MethodSettings_LongRunning {
    const message = createBaseMethodSettings_LongRunning();
    message.initialPollDelay = (object.initialPollDelay !== undefined && object.initialPollDelay !== null)
      ? Duration.fromPartial(object.initialPollDelay)
      : undefined;
    message.pollDelayMultiplier = object.pollDelayMultiplier ?? 0;
    message.maxPollDelay = (object.maxPollDelay !== undefined && object.maxPollDelay !== null)
      ? Duration.fromPartial(object.maxPollDelay)
      : undefined;
    message.totalPollTimeout = (object.totalPollTimeout !== undefined && object.totalPollTimeout !== null)
      ? Duration.fromPartial(object.totalPollTimeout)
      : undefined;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
