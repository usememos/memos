/**
 * Remark plugin to disable setext header syntax.
 *
 * Setext headers use underlines (=== or ---) to create headings:
 *   Heading 1
 *   =========
 *
 *   Heading 2
 *   ---------
 *
 * This plugin disables the setext heading construct at the micromark parser level,
 * preventing these patterns from being recognized as headers.
 */
export function remarkDisableSetext(this: any) {
  const data = this.data();

  add("micromarkExtensions", {
    disable: {
      null: ["setextUnderline"],
    },
  });

  /**
   * Add a micromark extension to the parser configuration.
   */
  function add(field: string, value: any) {
    const list = data[field] ? data[field] : (data[field] = []);
    list.push(value);
  }
}
