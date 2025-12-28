export function remarkDisableSetext(this: unknown) {
  const data = (this as { data: () => Record<string, unknown> }).data();

  add("micromarkExtensions", {
    disable: {
      null: ["setextUnderline"],
    },
  });

  function add(field: string, value: unknown) {
    const list = data[field] ? (data[field] as unknown[]) : (data[field] = []);
    list.push(value);
  }
}
