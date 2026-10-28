/** Every endpoint's JSON body: the data plus when it was fetched and its fingerprint. */
export interface ApiResponse<T> {
  asOf: string; // when the server got this data (ISO 8601 time)
  etag: string; // a fingerprint of the data
  data: T; // the data itself
}
