const singaporeDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Singapore",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Singapore calendar date of an instant, as yyyy-mm-dd, whatever time zone the server runs in. */
export const singaporeDate = (t: Date) => singaporeDay.format(t);
