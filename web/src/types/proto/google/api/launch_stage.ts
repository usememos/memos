/* eslint-disable */

export const protobufPackage = "google.api";

/**
 * The launch stage as defined by [Google Cloud Platform
 * Launch Stages](https://cloud.google.com/terms/launch-stages).
 */
export enum LaunchStage {
  /** LAUNCH_STAGE_UNSPECIFIED - Do not use this default value. */
  LAUNCH_STAGE_UNSPECIFIED = 0,
  /** UNIMPLEMENTED - The feature is not yet implemented. Users can not use it. */
  UNIMPLEMENTED = 6,
  /** PRELAUNCH - Prelaunch features are hidden from users and are only visible internally. */
  PRELAUNCH = 7,
  /**
   * EARLY_ACCESS - Early Access features are limited to a closed group of testers. To use
   * these features, you must sign up in advance and sign a Trusted Tester
   * agreement (which includes confidentiality provisions). These features may
   * be unstable, changed in backward-incompatible ways, and are not
   * guaranteed to be released.
   */
  EARLY_ACCESS = 1,
  /**
   * ALPHA - Alpha is a limited availability test for releases before they are cleared
   * for widespread use. By Alpha, all significant design issues are resolved
   * and we are in the process of verifying functionality. Alpha customers
   * need to apply for access, agree to applicable terms, and have their
   * projects allowlisted. Alpha releases don't have to be feature complete,
   * no SLAs are provided, and there are no technical support obligations, but
   * they will be far enough along that customers can actually use them in
   * test environments or for limited-use tests -- just like they would in
   * normal production cases.
   */
  ALPHA = 2,
  /**
   * BETA - Beta is the point at which we are ready to open a release for any
   * customer to use. There are no SLA or technical support obligations in a
   * Beta release. Products will be complete from a feature perspective, but
   * may have some open outstanding issues. Beta releases are suitable for
   * limited production use cases.
   */
  BETA = 3,
  /**
   * GA - GA features are open to all developers and are considered stable and
   * fully qualified for production use.
   */
  GA = 4,
  /**
   * DEPRECATED - Deprecated features are scheduled to be shut down and removed. For more
   * information, see the "Deprecation Policy" section of our [Terms of
   * Service](https://cloud.google.com/terms/)
   * and the [Google Cloud Platform Subject to the Deprecation
   * Policy](https://cloud.google.com/terms/deprecation) documentation.
   */
  DEPRECATED = 5,
  UNRECOGNIZED = -1,
}
