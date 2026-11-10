const modifiedFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatModified(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return modifiedFormatter.format(date);
}

export function documentHref(type: string, id: string): string {
  return `/${type}/${id}`;
}
